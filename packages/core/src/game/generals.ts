import { hexDistance } from '../hex/hex';
import type { BattleState, PlayerSlot } from './battleState';
import type { GameEvent, Outcome, Rejection } from './command';
import { moraleChanged, shiftMorale } from './morale';
import type { BattleDefs } from './rules';
import type { FieldedUnit, Unit } from './unit';
import { abilityOf, fieldedUnits, isFielded, isFighting, withUnits } from './unit';

/** Whether the unit leads its army: its type has the `command` ability. */
export function isGeneral(defs: BattleDefs, unit: Unit): boolean {
  return abilityOf(defs, unit, 'command') !== undefined;
}

/** The general of the side that is on the field and still fights, if it has one. */
export function fightingGeneral(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): FieldedUnit | undefined {
  return fieldedUnits(state, player).find((unit) => isFighting(unit) && isGeneral(defs, unit));
}

/** Whether a fighting general of the unit's side stands within `range` hexes of it. */
function nearGeneral(state: BattleState, defs: BattleDefs, unit: FieldedUnit, range: number) {
  const general = fightingGeneral(state, defs, unit.owner);
  return !!general && hexDistance(general.pos, unit.pos) <= range;
}

/** Whether the unit stands within its general's command: it takes hits and rallies better. */
export function inCommand(state: BattleState, defs: BattleDefs, unit: FieldedUnit): boolean {
  return nearGeneral(state, defs, unit, defs.rules.command.range);
}

/** Whether the general is close enough to lead the unit himself: its order costs nothing. */
export function isOrderFree(state: BattleState, defs: BattleDefs, unit: FieldedUnit): boolean {
  return nearGeneral(state, defs, unit, defs.rules.command.freeOrderRange);
}

/** Whether the side brought a general that is gone from the field: destroyed or fled. */
export function hasLostGeneral(state: BattleState, defs: BattleDefs, player: PlayerSlot): boolean {
  return Object.values(state.units).some(
    (unit) =>
      unit.owner === player &&
      isGeneral(defs, unit) &&
      (unit.status === 'dead' || unit.status === 'fled')
  );
}

/** Orders the side gets every turn; `null` when the battle does not limit them. */
export function ordersPerTurn(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): number | null {
  const orders = defs.orders[player];
  if (orders === undefined) return null;
  const lost = hasLostGeneral(state, defs, player) ? defs.rules.command.ordersLostWithGeneral : 0;
  return Math.max(1, orders - lost);
}

/** Orders the player on the move has left this turn; `null` when they are not limited. */
export function ordersLeft(state: BattleState, defs: BattleDefs): number | null {
  const perTurn = ordersPerTurn(state, defs, state.activePlayer);
  if (perTurn === null) return null;
  return Math.min(perTurn, state.ordersLeft ?? perTurn);
}

/** What giving the unit its first order this turn costs: nothing, one order, or it is refused. */
export function orderCost(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit
): 0 | 1 | Rejection {
  if (unit.ordered) return 0;
  const left = ordersLeft(state, defs);
  if (left === null || isOrderFree(state, defs, unit)) return 0;
  if (left > 0) return 1;
  return {
    code: 'noOrders',
    message: `Player ${unit.owner} has no orders left this turn for unit "${unit.id}"`,
  };
}

/**
 * The state with the unit taking its order: marked as ordered for the rest of the turn, and the
 * order counted when it was not free. Call only after `orderCost` allowed it.
 */
export function giveOrder(state: BattleState, defs: BattleDefs, unit: FieldedUnit): BattleState {
  if (unit.ordered) return state;
  const cost = orderCost(state, defs, unit);
  if (typeof cost !== 'number') throw new Error(cost.message);
  const left = ordersLeft(state, defs);
  const ordered = withUnits(state, [{ ...unit, ordered: true }]);
  return left === null ? ordered : { ...ordered, ordersLeft: left - cost };
}

/**
 * What the fall of a general does once a command is carried out: a general that was on the
 * field before and is gone after it shakes the whole of its army.
 */
export function afterGeneralsFell(
  before: BattleState,
  outcome: Outcome,
  defs: BattleDefs
): Outcome {
  const fallen = Object.values(outcome.state.units).filter((unit) => {
    const was = before.units[unit.id];
    return !!was && isFielded(was) && !isFielded(unit) && isGeneral(defs, unit);
  });
  if (fallen.length === 0) return outcome;

  let state = outcome.state;
  const events: GameEvent[] = [...outcome.events];
  for (const general of fallen) {
    events.push({ type: 'GeneralFell', player: general.owner, unitId: general.id });
    const shaken: Unit[] = [];
    for (const unit of fieldedUnits(state, general.owner)) {
      const moved = shiftMorale(unit, -defs.rules.command.moraleLostWithGeneral, defs.rules.morale);
      if (moved === unit) continue;
      shaken.push(moved);
      events.push(moraleChanged(moved));
    }
    state = withUnits(state, shaken);
  }
  return { state, events };
}
