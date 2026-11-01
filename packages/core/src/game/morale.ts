import { hexEquals } from '../hex/hex';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import type { MoraleChangedEvent } from './command';
import type { BattleDefs, MoraleRules } from './rules';
import type { FieldedUnit, Unit } from './unit';
import { abilityOf, adjacentUnits, isFighting, moraleStateOf, unitTypeOf } from './unit';

/** The unit with its morale moved by `delta`, kept between zero and `cap`. */
export function shiftMorale(
  unit: Unit,
  delta: number,
  rules: MoraleRules,
  cap: number = rules.max
): Unit {
  const morale =
    delta > 0
      ? Math.max(unit.morale, Math.min(cap, unit.morale + delta))
      : Math.max(0, unit.morale + delta);
  if (morale === unit.morale) return unit;
  return { ...unit, morale, moraleState: moraleStateOf(morale, rules) };
}

export function moraleChanged(unit: Unit): MoraleChangedEvent {
  return {
    type: 'MoraleChanged',
    unitId: unit.id,
    morale: unit.morale,
    moraleState: unit.moraleState,
  };
}

/** Whether enough enemies that still fight stand around the unit to encircle it. */
export function isEncircled(state: BattleState, defs: BattleDefs, unit: FieldedUnit): boolean {
  const enemies = adjacentUnits(state, unit.pos, opponentOf(unit.owner)).filter(isFighting);
  return enemies.length >= defs.rules.morale.encircledAt;
}

/** Whether the unit stands in its side's camp; behind its walls nothing shakes it. */
export function holdsOwnCamp(defs: BattleDefs, unit: FieldedUnit): boolean {
  const camp = defs.camps[unit.owner];
  return camp !== undefined && hexEquals(camp, unit.pos);
}

/** Whether the unit has lost so much of its strength that it breaks easily. */
export function isWorn(defs: BattleDefs, unit: Unit): boolean {
  return unit.hp <= unitTypeOf(defs, unit).hp * defs.rules.morale.wornAt;
}

/** What kind of hit a unit took, beyond who dealt it. */
export interface Hit {
  /** Health the hit took. */
  readonly damage: number;
  /** The hit came into the unit's rear. */
  readonly rear?: boolean;
  /** The hit was a cavalry charge. */
  readonly charge?: boolean;
}

/** Whether another unit of the unit's side that still fights stands next to it. */
export function isSupported(state: BattleState, unit: FieldedUnit): boolean {
  return adjacentUnits(state, unit.pos, unit.owner).some(
    (friend) => friend.id !== unit.id && isFighting(friend)
  );
}

/**
 * Morale a unit loses when `striker` hurts it; `victim` is the unit as the hit left it. The
 * harder the hit, the more it costs; a unit with its line beside it takes it better.
 */
export function moraleLossWhenHit(
  state: BattleState,
  defs: BattleDefs,
  victim: FieldedUnit,
  striker: Unit,
  hit: Hit
): number {
  const rules = defs.rules.morale;
  const byDamage = rules.lossWhenHit + Math.floor(hit.damage / rules.damagePerMoraleLoss);
  const support = isSupported(state, victim) ? rules.lineSupport : 0;
  const encircled = isEncircled(state, defs, victim) ? rules.lossWhenEncircled : 0;
  const worn = isWorn(defs, victim) ? rules.lossWhenWorn : 0;
  const fear = abilityOf(defs, striker, 'fear')?.params.moraleLoss ?? 0;
  const rear = hit.rear ? rules.lossWhenHitInRear : 0;
  const charge = hit.charge ? rules.lossWhenCharged : 0;
  return (
    Math.max(rules.minLossWhenHit, byDamage - support) + encircled + worn + fear + rear + charge
  );
}
