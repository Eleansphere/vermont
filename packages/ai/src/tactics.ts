import type {
  BattleDefs,
  BattleState,
  Command,
  Draw,
  FieldedUnit,
  Hex,
  PlayerSlot,
  RngState,
} from '@vermont/core';
import {
  HILL_RANGE_BONUS,
  abilityOf,
  adjacentUnits,
  attackTargets,
  fieldedUnits,
  hexDistance,
  hexEquals,
  isFighting,
  moraleLossWhenHit,
  nextRandom,
  opponentOf,
  pathFromReach,
  previewAttack,
  terrainAt,
  terrainMoveCost,
  unitReach,
  unitTypeOf,
} from '@vermont/core';
import type { Orders, PlanOptions, Role } from './plan';
import { battlePlan, isWeakened } from './plan';
import { travelCost } from './routes';

/** How an AI that thinks about its orders goes about a turn. */
export interface Tactics {
  readonly plan: PlanOptions;
  /** Whether fresh units take the place of weakened ones in the line. */
  readonly relief: boolean;
  /** Whether the army advances together, nobody far ahead of the rest. */
  readonly formation: boolean;
  /**
   * Whether a place to move to is judged by the attack the unit would have from it. Without
   * it a unit just makes for its objective and strikes at whatever it then finds in reach.
   */
  readonly looksAhead: boolean;
  /**
   * How far off, either way, the AI may be when it compares two moves or two attacks. It is
   * what makes two battles from different seeds differ, and a careless player weaker.
   */
  readonly misjudgement: number;
}

/** A command the AI considers and how much it expects of it. */
interface Option {
  readonly command: Command;
  readonly value: number;
}

interface Situation {
  readonly state: BattleState;
  readonly defs: BattleDefs;
  readonly player: PlayerSlot;
  /** The player's units that take orders. */
  readonly own: readonly FieldedUnit[];
  /** Every enemy unit the player sees. */
  readonly enemies: readonly FieldedUnit[];
  /** The enemies among them that can still strike. */
  readonly threats: readonly FieldedUnit[];
  readonly plan: ReadonlyMap<string, Orders>;
  readonly enemyCamp: Hex | null;
  readonly tactics: Tactics;
  /** `advanceLimit` of the units asked about so far. */
  readonly advanceLimits: Map<string, number>;
  /** How much the AI misjudges the next thing it weighs: drawn anew at every call. */
  readonly misjudge: () => number;
}

const HOLD: Orders = { role: 'fight', objective: null };

/** Worth of standing on the enemy camp: it wins the battle, so nothing compares. */
const VICTORY = 1000;
/** Worth of destroying the target, on top of the damage done. */
const KILL_BONUS = 4;
/** Worth of a hit that breaks the target's morale and sends it running. */
const ROUT_BONUS = 2.5;
/** A unit already running is worth less of an attack. */
const ROUTING_TARGET_FACTOR = 0.5;
/** How a point of damage taken in return weighs against a point done. */
const COUNTER_WEIGHT = 0.8;
const WEAK_COUNTER_WEIGHT = 1.5;
/** Worth of each unit of the same side close by, up to `MAX_COMPANY` of them. */
const COMPANY_VALUE = 0.3;
const MAX_COMPANY = 3;
const COMPANY_DISTANCE = 2;
/** Worth of taking a weakened unit's place in the line. */
const RELIEF_VALUE = 2.5;
/** A move has to be better than staying by this much, or units would shuffle for nothing. */
const MIN_GAIN = 0.2;
/** Breaks ties in favour of the shorter march. */
const STEP_COST = 0.01;
/** How far ahead of its support a unit may go, in movement points. */
const LEAD = 2;
/** Which of the other units, counted from the nearest to the objective, is the support. */
const SUPPORT_RANK = 1;
/** Share of an enemy's strength that counts as a threat at the far end of its march. */
const DISTANT_THREAT = 0.6;

/** More than any attack is worth: the guard strikes from the camp but never leaves it. */
const GUARD_PULL = 50;
/** How strongly each role is drawn to its objective, per movement point of the way there. */
const PULL: Readonly<Record<Role, number>> = {
  fight: 1,
  guard: GUARD_PULL,
  raid: 1.5,
  rest: 0.3,
};
/** How much of the damage it may take on a hex each role minds. */
const CAUTION: Readonly<Record<Role, number>> = { fight: 0.15, guard: 0, raid: 0.3, rest: 1 };
/** Shooters hang back: they need the enemy in range, not in reach. */
const SHOOTER_PULL = 0.5;
const SHOOTER_CAUTION = 0.5;

/**
 * The next command of a turn: every possible move and attack is given a value and the best
 * one is ordered, until nothing is worth doing and the turn ends. `state` is what the player
 * knows, so an enemy in the fog plays no part in it.
 */
export function tacticalOrders(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot,
  tactics: Tactics,
  rng: RngState
): Draw<Command> {
  const enemies = fieldedUnits(state, opponentOf(player));
  let dice = rng;
  const misjudge = (): number => {
    const draw = nextRandom(dice);
    dice = draw.rng;
    return (2 * draw.value - 1) * tactics.misjudgement;
  };
  const situation: Situation = {
    state,
    defs,
    player,
    own: fieldedUnits(state, player).filter(isFighting),
    enemies,
    threats: enemies.filter(isFighting),
    plan: battlePlan(state, defs, player, tactics.plan),
    enemyCamp: defs.camps[opponentOf(player)] ?? null,
    tactics,
    advanceLimits: new Map(),
    misjudge,
  };

  // A unit strikes as soon as it can: whoever lands the first blows usually wins the fight.
  for (const option of [winningMove, bestRelief, bestAttack, bestMove]) {
    const best = option(situation);
    if (best) return { value: best.command, rng: dice };
  }
  return { value: { type: 'EndTurn' }, rng: dice };
}

/** A march into the enemy camp, when some unit can make it this turn. */
function winningMove(situation: Situation): Option | null {
  const { state, defs, enemyCamp } = situation;
  if (!enemyCamp) return null;
  for (const unit of situation.own) {
    const path = pathFromReach(unitReach(state, defs, unit), enemyCamp);
    if (path && path.hexes.length > 1) {
      return { command: { type: 'MoveUnit', unitId: unit.id, path: path.hexes }, value: VICTORY };
    }
  }
  return null;
}

function bestAttack(situation: Situation): Option | null {
  const { state, defs } = situation;
  let best: Option | null = null;
  for (const unit of situation.own) {
    if (unit.hasAttacked) continue;
    const resting = situation.plan.get(unit.id)?.role === 'rest';
    for (const target of attackTargets(state, defs, unit)) {
      // A resting unit strikes only where nothing strikes back.
      if (resting && strikesBack(state, defs, unit, target)) continue;
      const worth = attackValue(situation, state, unit, target);
      if (worth === null || worth <= 0) continue;
      const value = worth + situation.misjudge();
      if (!best || value > best.value) {
        best = { command: { type: 'Attack', unitId: unit.id, targetId: target.id }, value };
      }
    }
  }
  return best;
}

function bestMove(situation: Situation): Option | null {
  const { state, defs } = situation;
  let best: Option | null = null;
  for (const unit of situation.own) {
    if (unit.movementLeft <= 0) continue;
    const reach = unitReach(state, defs, unit);
    const staying = positionValue(situation, unit, unit.pos);
    for (const node of reach.values()) {
      if (!node.canStop || node.cost === 0) continue;
      const gain = positionValue(situation, unit, node.hex) - staying - STEP_COST * node.cost;
      if (gain <= MIN_GAIN) continue;
      const value = gain + situation.misjudge();
      if (!best || value > best.value) {
        const path = pathFromReach(reach, node.hex)!.hexes;
        best = { command: { type: 'MoveUnit', unitId: unit.id, path }, value };
      }
    }
  }
  return best;
}

function strikesBack(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit,
  target: FieldedUnit
): boolean {
  const preview = previewAttack(state, defs, attacker, target);
  return 'kind' in preview && (preview.counterDamage?.max ?? 0) > 0;
}

/** A fresh unit behind the line changes places with a weakened one that stands in it. */
function bestRelief(situation: Situation): Option | null {
  const { state, defs, player } = situation;
  if (!situation.tactics.relief) return null;
  const inContact = (unit: FieldedUnit) =>
    adjacentUnits(state, unit.pos, opponentOf(player)).some(isFighting);

  for (const unit of situation.own) {
    if (!abilityOf(defs, unit, 'lineRelief') || unit.hasAttacked || unit.movementLeft <= 0) {
      continue;
    }
    if (isWeakened(defs, unit) || inContact(unit)) continue;
    for (const partner of adjacentUnits(state, unit.pos, player)) {
      const worthIt = isFighting(partner) && isWeakened(defs, partner) && inContact(partner);
      if (worthIt && canStandOn(defs, unit, partner.pos) && canStandOn(defs, partner, unit.pos)) {
        return {
          command: {
            type: 'UseAbility',
            unitId: unit.id,
            abilityId: 'lineRelief',
            targetId: partner.id,
          },
          value: RELIEF_VALUE,
        };
      }
    }
  }
  return null;
}

function canStandOn(defs: BattleDefs, unit: FieldedUnit, target: Hex): boolean {
  const terrain = terrainAt(defs.map, defs.terrains, target);
  return !!terrain && terrainMoveCost(terrain, unitTypeOf(defs, unit).archetype) !== null;
}

/**
 * What attacking `target` is worth to `attacker`, or `null` when it cannot attack it. `state`
 * is where the attacker is taken to stand, which need not be where it stands now.
 */
function attackValue(
  situation: Situation,
  state: BattleState,
  attacker: FieldedUnit,
  target: FieldedUnit
): number | null {
  const { defs } = situation;
  const preview = previewAttack(state, defs, attacker, target);
  if (!('kind' in preview)) return null;

  const damage = preview.damage.expected;
  const counter = preview.counterDamage?.expected ?? 0;
  const care = isWeakened(defs, attacker) ? WEAK_COUNTER_WEIGHT : COUNTER_WEIGHT;

  let value = damage - care * counter;
  if (damage >= target.hp) value += KILL_BONUS;
  else if (isFighting(target) && breaksMorale(state, defs, attacker, target, damage)) {
    value += ROUT_BONUS;
  }
  if (!isFighting(target)) value *= ROUTING_TARGET_FACTOR;
  if (counter >= attacker.hp) value -= KILL_BONUS;
  return value;
}

/** Whether a hit of `damage` by `attacker` would leave the target's morale low enough to run. */
function breaksMorale(
  state: BattleState,
  defs: BattleDefs,
  attacker: FieldedUnit,
  target: FieldedUnit,
  damage: number
): boolean {
  const hurt = { ...target, hp: target.hp - damage };
  return (
    target.morale - moraleLossWhenHit(state, defs, hurt, attacker) <= defs.rules.morale.routingAt
  );
}

/** The best attack the unit would have from `at`, or 0 when it has none there. */
function bestAttackFrom(situation: Situation, unit: FieldedUnit, at: Hex): number {
  if (unit.hasAttacked) return 0;
  const moved: FieldedUnit = { ...unit, pos: at };
  const state = hexEquals(at, unit.pos)
    ? situation.state
    : { ...situation.state, units: { ...situation.state.units, [unit.id]: moved } };
  const shootingRange = (unitTypeOf(situation.defs, unit).range ?? 0) + HILL_RANGE_BONUS;

  let best = 0;
  for (const enemy of situation.enemies) {
    const distance = hexDistance(at, enemy.pos);
    if (distance > 1 && distance > shootingRange) continue;
    best = Math.max(best, attackValue(situation, state, moved, enemy) ?? 0);
  }
  return best;
}

/**
 * How good a place `at` is for the unit: near its objective, with an enemy to strike and
 * friends around, and not where the enemy would hurt it more than its role is worth.
 */
function positionValue(situation: Situation, unit: FieldedUnit, at: Hex): number {
  const { defs } = situation;
  if (situation.enemyCamp && hexEquals(at, situation.enemyCamp)) return VICTORY;

  const type = unitTypeOf(defs, unit);
  const orders = situation.plan.get(unit.id) ?? HOLD;
  const shoots = type.range !== undefined && orders.role === 'fight';

  let value = situation.tactics.looksAhead ? bestAttackFrom(situation, unit, at) : 0;
  if (orders.objective) {
    const pull = shoots ? SHOOTER_PULL : PULL[orders.role];
    const way = travelCost(defs, type.archetype, orders.objective, at);
    value -= pull * Math.max(way, advanceLimit(situation, unit, orders));
  }
  const caution = shoots ? SHOOTER_CAUTION : CAUTION[orders.role];
  if (caution > 0) {
    let danger = 0;
    for (const enemy of situation.threats) danger += threat(defs, enemy, unit, at);
    value -= caution * danger;
  }
  if (orders.role === 'fight') {
    const company = situation.own.filter(
      (friend) => friend.id !== unit.id && hexDistance(friend.pos, at) <= COMPANY_DISTANCE
    ).length;
    value += COMPANY_VALUE * Math.min(MAX_COMPANY, company);
  }
  return value;
}

/**
 * How near its objective a unit is drawn: no more than `LEAD` ahead of the unit of its side
 * that is second nearest to it. Going further on its own gains it nothing, so the army arrives
 * together. 0 when the unit is not held back.
 */
function advanceLimit(situation: Situation, unit: FieldedUnit, orders: Orders): number {
  if (!situation.tactics.formation || orders.role !== 'fight' || !orders.objective) return 0;
  const known = situation.advanceLimits.get(unit.id);
  if (known !== undefined) return known;

  const { archetype } = unitTypeOf(situation.defs, unit);
  const objective = orders.objective;
  const ways = situation.own
    .filter((friend) => friend.id !== unit.id)
    .map((friend) => travelCost(situation.defs, archetype, objective, friend.pos))
    .sort((a, b) => a - b);
  const limit = Math.max(0, (ways[SUPPORT_RANK] ?? 0) - LEAD);
  situation.advanceLimits.set(unit.id, limit);
  return limit;
}

/** Damage `enemy` is likely to do to the unit on `at` next turn, less the further it has to come. */
function threat(defs: BattleDefs, enemy: FieldedUnit, unit: FieldedUnit, at: Hex): number {
  const type = unitTypeOf(defs, enemy);
  const striking = type.range ?? 1;
  const distance = hexDistance(enemy.pos, at);
  const nearness =
    distance <= striking
      ? 1
      : DISTANT_THREAT * Math.max(0, 1 - (distance - striking) / type.movement);
  return nearness === 0 ? 0 : nearness * roughDamage(defs, enemy, unit, at);
}

/**
 * Roughly what a strike by `striker` does to `target` standing on `at`: the core's formula
 * without the bonuses that depend on who else stands around.
 */
function roughDamage(defs: BattleDefs, striker: FieldedUnit, target: FieldedUnit, at: Hex): number {
  const rules = defs.rules.combat;
  const strikerType = unitTypeOf(defs, striker);
  const targetType = unitTypeOf(defs, target);
  const ground = terrainAt(defs.map, defs.terrains, at);
  const groundBonus = ground?.defenseBonus ?? 0;
  const hindered = ground?.hinders?.includes(targetType.archetype) ?? false;
  const defense = Math.max(
    1,
    targetType.defense + (hindered ? Math.min(0, groundBonus) : groundBonus)
  );
  const health = striker.hp / strikerType.hp;

  let damage = (rules.baseDamage * strikerType.attack) / defense;
  damage *= rules.woundedFloor + (1 - rules.woundedFloor) * health;
  if (rules.advantages[strikerType.archetype].includes(targetType.archetype)) {
    damage *= rules.advantageFactor;
  }
  return damage;
}
