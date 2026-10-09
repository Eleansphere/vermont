import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import type { MoraleChangedEvent } from './command';
import type { BattleDefs, MoraleRules } from './rules';
import type { FieldedUnit, Unit } from './unit';
import { abilityOf, adjacentUnits, isFighting, moraleStateOf } from './unit';

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

/** Morale a unit loses when `striker` hurts it. */
export function moraleLossWhenHit(
  state: BattleState,
  defs: BattleDefs,
  victim: FieldedUnit,
  striker: Unit
): number {
  const rules = defs.rules.morale;
  const encircled = isEncircled(state, defs, victim) ? rules.lossWhenEncircled : 0;
  const fear = abilityOf(defs, striker, 'fear')?.params.moraleLoss ?? 0;
  return rules.lossWhenHit + encircled + fear;
}
