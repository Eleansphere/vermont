import type { Archetype } from '../archetype';
import { hexDistance } from '../hex/hex';
import { terrainAt } from '../map/battleMap';
import type { TerrainDef } from '../map/terrain';
import { hasLineOfSight, rangeFrom } from '../sight/sight';
import type { AbilityId } from '../units/unitType';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import type { AttackKind, GameEvent, Outcome, Rejection } from './command';
import { holdsOwnCamp, moraleChanged, moraleLossWhenHit, shiftMorale } from './morale';
import { nextRandom, nextRandomInt } from './rng';
import { retreat } from './rout';
import type { BattleDefs } from './rules';
import type { FieldedUnit, Unit } from './unit';
import {
  abilityOf,
  adjacentUnits,
  fieldedUnits,
  isFielded,
  isFighting,
  unitHexes,
  unitTypeOf,
  withUnits,
} from './unit';

/** A strike is either the attack a player ordered or the target's answer to it. */
type StrikeRole = 'attack' | 'counter';

const MIN_STAT = 1;
/** Roll that gives exactly the expected damage. */
const AVERAGE_ROLL = 0.5;

export interface DamageRange {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

/** What an attack would do, for showing to the player before they order it. */
export interface AttackPreview {
  readonly kind: AttackKind;
  readonly damage: DamageRange;
  /** Damage the attacker would take in return; `null` when the target cannot strike back. */
  readonly counterDamage: DamageRange | null;
}

/**
 * Whether `attacker` may attack `target` from where they stand, and how: hand to hand when
 * they are adjacent, by shooting otherwise. Does not look at whose turn it is.
 */
export function attackKindFor(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit,
  target: FieldedUnit
): AttackKind | Rejection {
  if (target.owner === attacker.owner) {
    return { code: 'invalidTarget', message: `Unit "${target.id}" is on the attacker's side` };
  }
  const distance = hexDistance(attacker.pos, target.pos);
  if (distance === 1) return 'melee';

  const range = unitTypeOf(defs, attacker).range;
  if (range === undefined) {
    return { code: 'outOfRange', message: `Unit "${attacker.id}" can only attack adjacent units` };
  }
  if (adjacentUnits(state, attacker.pos, target.owner).some(isFighting)) {
    return {
      code: 'engaged',
      message: `Unit "${attacker.id}" cannot shoot with an enemy next to it`,
    };
  }
  if (distance > rangeFrom(defs.map, attacker.pos, range, defs.terrains)) {
    return { code: 'outOfRange', message: `Unit "${target.id}" is out of range` };
  }
  const sight = { terrains: defs.terrains, units: unitHexes(fieldedUnits(state)) };
  if (!hasLineOfSight(defs.map, attacker.pos, target.pos, sight)) {
    return { code: 'noLineOfSight', message: `Unit "${attacker.id}" cannot see "${target.id}"` };
  }
  return 'ranged';
}

/** Enemy units `attacker` could attack right now from its hex. */
export function attackTargets(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit
): FieldedUnit[] {
  return fieldedUnits(state, opponentOf(attacker.owner)).filter(
    (target) => typeof attackKindFor(state, defs, attacker, target) === 'string'
  );
}

/**
 * Expected losses of both sides if `attacker` attacked `target` now, or the reason why it
 * cannot. The real result differs by the random spread.
 */
export function previewAttack(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit,
  target: FieldedUnit
): AttackPreview | Rejection {
  const kind = attackKindFor(state, defs, attacker, target);
  if (typeof kind !== 'string') return kind;

  const attack = expectedDamage(state, defs, attacker, target, 'attack');
  const damage = damageRange(defs, attack, target.hp, 'attack');
  if (!strikesBack(defs, kind, attacker, target)) {
    return { kind, damage, counterDamage: null };
  }

  // The harder the target is hit, the weaker its answer.
  const counterAfter = (damageTaken: number, roll: number): number => {
    const survivor = { ...target, hp: target.hp - damageTaken };
    if (survivor.hp <= 0) return 0;
    const counter = expectedDamage(state, defs, survivor, attacker, 'counter');
    return rollDamage(defs, counter, roll, attacker.hp, 'counter');
  };
  return {
    kind,
    damage,
    counterDamage: {
      min: counterAfter(damage.max, 0),
      expected: counterAfter(damage.expected, AVERAGE_ROLL),
      max: counterAfter(damage.min, 1),
    },
  };
}

/** Carries out an attack that `attackKindFor` allowed. */
export function resolveAttack(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit,
  target: FieldedUnit,
  kind: AttackKind
): Outcome {
  const attackRoll = nextRandom(state.rng);
  let rng = attackRoll.rng;
  const expected = expectedDamage(state, defs, attacker, target, 'attack');
  const damage = rollDamage(defs, expected, attackRoll.value, target.hp, 'attack');
  const hurtTarget = { ...target, hp: target.hp - damage };

  let counterDamage: number | null = null;
  if (hurtTarget.hp > 0 && strikesBack(defs, kind, attacker, target)) {
    const counterRoll = nextRandom(rng);
    rng = counterRoll.rng;
    const counter = expectedDamage(state, defs, hurtTarget, attacker, 'counter');
    counterDamage = rollDamage(defs, counter, counterRoll.value, attacker.hp, 'counter');
  }
  const hurtAttacker = afterAttacking(defs, attacker, counterDamage ?? 0);

  const events: GameEvent[] = [
    {
      type: 'AttackResolved',
      attackerId: attacker.id,
      targetId: target.id,
      kind,
      damage,
      counterDamage,
    },
  ];
  const blows: Blow[] = [
    { hurt: hurtTarget, damage, striker: attacker },
    { hurt: hurtAttacker, damage: counterDamage ?? 0, striker: target },
  ];
  const wonAttack = damage > (counterDamage ?? 0) ? defs.rules.morale.gainForWonAttack : 0;
  const fought = settleBlows({ ...state, rng }, defs, blows, events, [[attacker.id, wonAttack]]);
  return { state: routBroken(state, fought, defs, events), events };
}

/** A strike that was dealt: the unit as it left it, how much it took and who struck. */
interface Blow {
  readonly hurt: FieldedUnit;
  readonly damage: number;
  readonly striker: Unit;
}

/**
 * Takes the blows into the state: the losses, and what they do to the morale of those hit and
 * of the units that see a neighbour of their side destroyed. `gains` is morale won besides.
 */
function settleBlows(
  state: BattleState,
  defs: BattleDefs,
  blows: readonly Blow[],
  events: GameEvent[],
  gains: readonly (readonly [unitId: string, morale: number])[] = []
): BattleState {
  const morale = new Map<string, number>();
  const addMorale = (unitId: string, delta: number) =>
    morale.set(unitId, (morale.get(unitId) ?? 0) + delta);

  const changed = new Map<string, Unit>();
  for (const { hurt, damage, striker } of blows) {
    changed.set(hurt.id, hurt);
    if (damage === 0) continue;
    events.push({ type: 'UnitDamaged', unitId: hurt.id, damage, hp: hurt.hp });
    if (hurt.hp > 0) {
      addMorale(hurt.id, -moraleLossWhenHit(state, defs, hurt, striker));
      continue;
    }
    events.push({ type: 'UnitDied', unitId: hurt.id, hex: hurt.pos });
    for (const ally of adjacentUnits(state, hurt.pos, hurt.owner)) {
      addMorale(ally.id, -defs.rules.morale.lossWhenAllyDies);
    }
    changed.set(hurt.id, { ...hurt, status: 'dead', pos: null });
  }
  for (const [unitId, gain] of gains) addMorale(unitId, gain);

  for (const [unitId, delta] of morale) {
    const unit = changed.get(unitId) ?? state.units[unitId]!;
    if (!isFielded(unit) || (delta < 0 && holdsOwnCamp(defs, unit))) continue;
    const shifted = shiftMorale(unit, delta, defs.rules.morale);
    if (shifted === unit) continue;
    changed.set(unitId, shifted);
    events.push(moraleChanged(shifted));
  }
  return withUnits(state, [...changed.values()]);
}

/**
 * Units that fought `before` and whose morale has broken since run from the enemy at once. One
 * after another: where a unit runs to depends on those that ran before it, and a rampage on
 * the way out may break more of them.
 */
function routBroken(
  before: BattleState,
  after: BattleState,
  defs: BattleDefs,
  events: GameEvent[]
): BattleState {
  let state = after;
  const ran = new Set<string>();
  for (;;) {
    const broken = fieldedUnits(state).find(
      (unit) =>
        unit.moraleState === 'routing' && !ran.has(unit.id) && isFighting(before.units[unit.id]!)
    );
    if (!broken) return state;
    ran.add(broken.id);

    state = rampage(state, defs, broken, events);
    const run = retreat(state, defs, broken);
    state = withUnits(state, [run.unit]);
    events.push(...run.events);
  }
}

/**
 * A unit with the `rampage` ability that breaks tramples one unit next to it before it runs,
 * friend or foe, whichever the dice pick. Nobody strikes back at it.
 */
function rampage(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit,
  events: GameEvent[]
): BattleState {
  if (!abilityOf(defs, unit, 'rampage')) return state;
  const inTheWay = fieldedUnits(state).filter((other) => hexDistance(other.pos, unit.pos) === 1);
  if (inTheWay.length === 0) return state;

  const pick = nextRandomInt(state.rng, 0, inTheWay.length - 1);
  const victim = inTheWay[pick.value]!;
  const roll = nextRandom(pick.rng);
  const expected = expectedDamage(state, defs, unit, victim, 'attack');
  const damage = rollDamage(defs, expected, roll.value, victim.hp, 'attack');

  events.push({ type: 'UnitRampaged', unitId: unit.id, targetId: victim.id, damage });
  const blow: Blow = { hurt: { ...victim, hp: victim.hp - damage }, damage, striker: unit };
  return settleBlows({ ...state, rng: roll.rng }, defs, [blow], events);
}

/** The attacker once its attack is over: hurt by the answer and with its turn used up. */
function afterAttacking(defs: BattleDefs, attacker: FieldedUnit, damageTaken: number): FieldedUnit {
  const usesPilum = hasUnspent(defs, attacker, 'pilum');
  return {
    ...attacker,
    hp: attacker.hp - damageTaken,
    hasAttacked: true,
    movementLeft: abilityOf(defs, attacker, 'hitAndRun')?.params.movement ?? 0,
    spentAbilities: usesPilum ? [...attacker.spentAbilities, 'pilum'] : attacker.spentAbilities,
  };
}

function strikesBack(
  defs: BattleDefs,
  kind: AttackKind,
  attacker: FieldedUnit,
  target: FieldedUnit
): boolean {
  return kind === 'melee' && isFighting(target) && !abilityOf(defs, attacker, 'hitAndRun');
}

function hasUnspent(defs: BattleDefs, unit: Unit, abilityId: AbilityId): boolean {
  return abilityOf(defs, unit, abilityId) !== undefined && !unit.spentAbilities.includes(abilityId);
}

/** Damage of the strike before the random spread and rounding. */
function expectedDamage(
  state: BattleState,
  defs: BattleDefs,
  striker: FieldedUnit,
  target: FieldedUnit,
  role: StrikeRole
): number {
  const rules = defs.rules.combat;
  const attack = attackValue(state, defs, striker, target, role);
  const defense = defenseValue(defs, target, unitTypeOf(defs, striker).archetype);
  return ((rules.baseDamage * attack) / defense) * damageFactor(state, defs, striker, target, role);
}

function attackValue(
  state: BattleState,
  defs: BattleDefs,
  striker: FieldedUnit,
  target: FieldedUnit,
  role: StrikeRole
): number {
  const rules = defs.rules.combat;
  const type = unitTypeOf(defs, striker);
  const ground = terrainAt(defs.map, defs.terrains, striker.pos);
  const targetGround = terrainAt(defs.map, defs.terrains, target.pos);

  let attack = type.attack + (ground?.attackBonus ?? 0);
  if (ground?.isHill && !targetGround?.isHill) attack += rules.downhillAttack;
  if (isHindered(ground, type.archetype)) attack += rules.hinderedAttack;
  if (role === 'attack') {
    if (hasUnspent(defs, striker, 'pilum')) attack += defs.abilities.pilum.params.attack ?? 0;
    attack += abilityOf(defs, striker, 'furiousCharge')?.params.attack ?? 0;
  }
  if (isFrightened(state, defs, striker)) attack += defs.abilities.fear.params.attack ?? 0;
  return Math.max(MIN_STAT, attack);
}

function defenseValue(defs: BattleDefs, target: FieldedUnit, strikerArchetype: Archetype): number {
  const type = unitTypeOf(defs, target);
  const ground = terrainAt(defs.map, defs.terrains, target.pos);
  const groundBonus = ground?.defenseBonus ?? 0;

  let defense = type.defense;
  // Ground that hinders the unit still counts against it, it just does not help.
  defense += isHindered(ground, type.archetype) ? Math.min(0, groundBonus) : groundBonus;
  const shieldWall = abilityOf(defs, target, 'shieldWall');
  if (shieldWall?.against?.includes(strikerArchetype)) defense += shieldWall.params.defense ?? 0;
  return Math.max(MIN_STAT, defense);
}

function damageFactor(
  state: BattleState,
  defs: BattleDefs,
  striker: FieldedUnit,
  target: FieldedUnit,
  role: StrikeRole
): number {
  const rules = defs.rules.combat;
  const type = unitTypeOf(defs, striker);
  const health = striker.hp / type.hp;
  const flankers = adjacentUnits(state, target.pos, striker.owner).filter(
    (unit) => unit.id !== striker.id && isFighting(unit)
  );

  let factor = rules.woundedFloor + (1 - rules.woundedFloor) * health;
  if (rules.advantages[type.archetype].includes(unitTypeOf(defs, target).archetype)) {
    factor *= rules.advantageFactor;
  }
  factor *= 1 + rules.flankBonus * flankers.length;
  if (striker.moraleState === 'shaken') factor *= defs.rules.morale.shakenAttackFactor;
  if (role === 'counter') factor *= rules.counterFactor;
  return factor;
}

function isHindered(ground: TerrainDef | undefined, archetype: Archetype): boolean {
  return ground?.hinders?.includes(archetype) ?? false;
}

/** Whether an enemy next to the unit frightens its archetype. */
function isFrightened(state: BattleState, defs: BattleDefs, unit: FieldedUnit): boolean {
  const archetype = unitTypeOf(defs, unit).archetype;
  return adjacentUnits(state, unit.pos, opponentOf(unit.owner)).some(
    (enemy) => isFighting(enemy) && abilityOf(defs, enemy, 'fear')?.against?.includes(archetype)
  );
}

/** Damage for a `roll` from 0 to 1, never more than the health the target has left. */
function rollDamage(
  defs: BattleDefs,
  expected: number,
  roll: number,
  targetHp: number,
  role: StrikeRole
): number {
  const rules = defs.rules.combat;
  const spread = 1 - rules.damageSpread + 2 * rules.damageSpread * roll;
  const minDamage = role === 'attack' ? rules.minAttackDamage : 0;
  return Math.min(targetHp, Math.max(minDamage, Math.round(expected * spread)));
}

function damageRange(
  defs: BattleDefs,
  expected: number,
  targetHp: number,
  role: StrikeRole
): DamageRange {
  return {
    min: rollDamage(defs, expected, 0, targetHp, role),
    expected: rollDamage(defs, expected, AVERAGE_ROLL, targetHp, role),
    max: rollDamage(defs, expected, 1, targetHp, role),
  };
}
