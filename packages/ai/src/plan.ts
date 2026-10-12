import type { BattleDefs, BattleState, FieldedUnit, Hex, PlayerSlot } from '@vermont/core';
import { fieldedUnits, hexDistance, isFighting, opponentOf, unitTypeOf } from '@vermont/core';
import { travelCost } from './routes';

/**
 * What a unit is in the battle for: `fight` goes for the enemy, `guard` holds its side's camp,
 * `raid` rides for the enemy's and `rest` keeps out of the fight until it has its nerve back.
 */
export type Role = 'fight' | 'guard' | 'raid' | 'rest';

export interface Orders {
  readonly role: Role;
  /** Where the unit is headed; `null` when there is nowhere to go and it holds its ground. */
  readonly objective: Hex | null;
}

export interface PlanOptions {
  /** Whether a unit is left to hold the camp. */
  readonly guard: boolean;
  /** Whether a fast unit is sent for the enemy camp once the battle is under way. */
  readonly raid: boolean;
  /** Whether shaken units are pulled back towards the camp to recover. */
  readonly rest: boolean;
}

/** At this share of its full health or below a unit is pulled out of the fight. */
const WEAK_HEALTH = 0.3;
/** Units this fast can ride round the enemy line. */
const FAST_MOVEMENT = 6;
/** A raider is sent only when that many fast units are left to do the cavalry's work. */
const FAST_UNITS_TO_RAID = 2;
/** The round the raider sets out in: by then the lines have met and the way round is open. */
const RAID_FROM_TURN = 3;
/** The last unit of an army has nobody to hold the camp for. */
const ARMY_TO_GUARD = 2;
/** For this many last rounds nobody guards the camp: a battle left undecided is a draw. */
const ALL_OUT_ROUNDS = 5;
/** How much nearer an enemy seems to a unit whose archetype has the advantage over it. */
const PREY_PULL = 3;

/** The unit of the list that stands nearest to `from`; the first of them when several do. */
export function nearestTo<U extends FieldedUnit>(units: readonly U[], from: Hex): U | undefined {
  let nearest: U | undefined;
  for (const unit of units) {
    if (!nearest || hexDistance(unit.pos, from) < hexDistance(nearest.pos, from)) nearest = unit;
  }
  return nearest;
}

/** Whether the unit is in no state to stand in the line: shaken, or nearly destroyed. */
export function isWeakened(defs: BattleDefs, unit: FieldedUnit): boolean {
  return unit.moraleState === 'shaken' || unit.hp <= unitTypeOf(defs, unit).hp * WEAK_HEALTH;
}

/**
 * Orders for every unit of `player` that still fights, from what the player knows. Nothing is
 * remembered between calls: the plan follows the field as it is seen now.
 */
export function battlePlan(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot,
  options: PlanOptions
): Map<string, Orders> {
  const own = fieldedUnits(state, player).filter(isFighting);
  const sighted = fieldedUnits(state, opponentOf(player));
  // Units already running are chased only when nobody else is left to fight.
  const standing = sighted.filter(isFighting);
  const enemies = standing.length > 0 ? standing : sighted;
  const ownCamp = defs.camps[player] ?? null;
  const enemyCamp = defs.camps[opponentOf(player)] ?? null;
  const allOut = state.turn > defs.rules.roundLimit - ALL_OUT_ROUNDS;

  const fit = own.filter((unit) => !isWeakened(defs, unit));
  const guard =
    options.guard && !allOut && ownCamp && own.length >= ARMY_TO_GUARD
      ? campGuard(defs, own, ownCamp)
      : undefined;
  const raider =
    options.raid && enemyCamp && state.turn >= RAID_FROM_TURN
      ? campRaider(defs, fit, enemyCamp, guard)
      : undefined;

  const plan = new Map<string, Orders>();
  for (const unit of own) {
    if (unit.id === guard?.id) {
      plan.set(unit.id, { role: 'guard', objective: ownCamp });
    } else if (unit.id === raider?.id) {
      plan.set(unit.id, { role: 'raid', objective: enemyCamp });
    } else if (options.rest && !allOut && unit.moraleState === 'shaken') {
      plan.set(unit.id, { role: 'rest', objective: ownCamp });
    } else {
      const target = preyOf(defs, unit, enemies);
      plan.set(unit.id, { role: 'fight', objective: target?.pos ?? enemyCamp });
    }
  }
  return plan;
}

/** The unit left at the camp: a foot unit that fights hand to hand, the nearest to the camp. */
function campGuard(
  defs: BattleDefs,
  own: readonly FieldedUnit[],
  camp: Hex
): FieldedUnit | undefined {
  const candidates = own.filter((unit) => {
    const type = unitTypeOf(defs, unit);
    return type.range === undefined && type.movement < FAST_MOVEMENT;
  });
  return nearestTo(candidates, camp);
}

/** The fast unit with the shortest way to the enemy camp, when the army can spare one. */
function campRaider(
  defs: BattleDefs,
  fit: readonly FieldedUnit[],
  enemyCamp: Hex,
  guard: FieldedUnit | undefined
): FieldedUnit | undefined {
  const fast = fit.filter(
    (unit) => unit.id !== guard?.id && unitTypeOf(defs, unit).movement >= FAST_MOVEMENT
  );
  if (fast.length < FAST_UNITS_TO_RAID) return undefined;

  const wayTo = (unit: FieldedUnit) =>
    travelCost(defs, unitTypeOf(defs, unit).archetype, enemyCamp, unit.pos);
  return fast.reduce((best, unit) => (wayTo(unit) < wayTo(best) ? unit : best));
}

/** The enemy the unit goes for: the nearest, with those it is strong against counted nearer. */
function preyOf(
  defs: BattleDefs,
  unit: FieldedUnit,
  enemies: readonly FieldedUnit[]
): FieldedUnit | undefined {
  const strongAgainst = defs.rules.combat.advantages[unitTypeOf(defs, unit).archetype];
  const pull = (enemy: FieldedUnit) =>
    hexDistance(enemy.pos, unit.pos) -
    (strongAgainst.includes(unitTypeOf(defs, enemy).archetype) ? PREY_PULL : 0);

  let prey: FieldedUnit | undefined;
  for (const enemy of enemies) {
    if (!prey || pull(enemy) < pull(prey)) prey = enemy;
  }
  return prey;
}
