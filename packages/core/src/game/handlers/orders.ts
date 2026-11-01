import type { BattleState } from '../battleState';
import type { Rejection } from '../command';
import { giveOrder, orderCost } from '../generals';
import type { BattleDefs } from '../rules';
import type { FieldedUnit, Unit } from '../unit';
import { isFielded } from '../unit';

/** The unit with the given id, which may come from outside and name no unit at all. */
export function findUnit(state: BattleState, unitId: string): Unit | undefined {
  return Object.hasOwn(state.units, unitId) ? state.units[unitId] : undefined;
}

/** The unit the active player wants to give an order to, or the reason it cannot take one. */
export function orderedUnit(state: BattleState, unitId: string): FieldedUnit | Rejection {
  const unit = findUnit(state, unitId);
  if (!unit) {
    return { code: 'unknownUnit', message: `Unknown unit: ${JSON.stringify(unitId)}` };
  }
  if (unit.owner !== state.activePlayer) {
    return { code: 'notYourUnit', message: `Unit "${unit.id}" belongs to the other player` };
  }
  if (!isFielded(unit)) {
    return { code: 'unitNotOnField', message: `Unit "${unit.id}" is no longer on the battlefield` };
  }
  if (unit.moraleState === 'routing') {
    return { code: 'unitRouting', message: `Unit "${unit.id}" is routing and takes no orders` };
  }
  return unit;
}

/**
 * The unit the active player wants to give an order to, with the order it needs counted out:
 * the unit's first order in a turn costs one, unless the general leads it himself.
 */
export function commandedUnit(
  state: BattleState,
  defs: BattleDefs,
  unitId: string
): FieldedUnit | Rejection {
  const unit = orderedUnit(state, unitId);
  if (isRejection(unit)) return unit;
  const cost = orderCost(state, defs, unit);
  return typeof cost === 'number' ? unit : cost;
}

/** The state with the unit's order given, and the unit as it stands in it. */
export function withOrderGiven(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit
): { readonly state: BattleState; readonly unit: FieldedUnit } {
  const ordered = giveOrder(state, defs, unit);
  return { state: ordered, unit: ordered.units[unit.id] as FieldedUnit };
}

/** Tells a rejection apart from the value a check returns when it passes. */
export function isRejection(result: object): result is Rejection {
  return 'code' in result && 'message' in result;
}
