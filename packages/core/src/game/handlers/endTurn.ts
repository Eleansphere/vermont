import type { BattleState } from '../battleState';
import { opponentOf } from '../battleState';
import type { CommandHandler, EndTurnCommand, GameEvent } from '../command';
import { moraleChanged, shiftMorale } from '../morale';
import type { UnitChange } from '../rout';
import type { BattleDefs } from '../rules';
import type { FieldedUnit } from '../unit';
import { adjacentUnits, fieldedUnits, isFighting, unitTypeOf, withUnits } from '../unit';

/** The player who moves first in a round; when the move returns to them, a new round starts. */
const ROUND_OPENER = 0;

export const endTurn: CommandHandler<EndTurnCommand> = {
  phases: ['battle'],

  apply(state, _command, defs) {
    const nextPlayer = opponentOf(state.activePlayer);
    const nextTurn = nextPlayer === ROUND_OPENER ? state.turn + 1 : state.turn;
    if (nextTurn > defs.rules.roundLimit) {
      return {
        state: { ...state, phase: 'ended', draw: true },
        events: [
          { type: 'TurnEnded', player: state.activePlayer, turn: state.turn },
          { type: 'BattleDrawn' },
        ],
      };
    }

    let next: BattleState = { ...state, activePlayer: nextPlayer, turn: nextTurn };
    const events: GameEvent[] = [
      { type: 'TurnEnded', player: state.activePlayer, turn: state.turn },
    ];
    for (const { id } of fieldedUnits(next, nextPlayer)) {
      const refresh = startTurnOf(next, defs, next.units[id] as FieldedUnit);
      next = withUnits(next, [refresh.unit]);
      events.push(...refresh.events);
    }
    events.push({ type: 'TurnStarted', player: nextPlayer, turn: nextTurn });
    return { state: next, events };
  },
};

function startTurnOf(state: BattleState, defs: BattleDefs, unit: FieldedUnit): UnitChange {
  if (unit.moraleState !== 'routing') return recover(state, defs, unit);
  return isPursued(state, unit) ? flee(unit) : rally(defs, unit);
}

/** A unit that fights gets its movement and attack back, and some morale if left in peace. */
function recover(state: BattleState, defs: BattleDefs, unit: FieldedUnit): UnitChange {
  const type = unitTypeOf(defs, unit);
  const rested = isPursued(state, unit)
    ? unit
    : shiftMorale(unit, defs.rules.morale.recoveryPerTurn, defs.rules.morale, type.morale);
  return {
    unit: { ...rested, movementLeft: type.movement, hasAttacked: false },
    events: rested === unit ? [] : [moraleChanged(rested)],
  };
}

/** A routing unit the enemy let go spends the turn steadying itself and fights on, shaken. */
function rally(defs: BattleDefs, unit: FieldedUnit): UnitChange {
  const rules = defs.rules.morale;
  const steadied = shiftMorale(unit, rules.routingAt + 1 - unit.morale, rules);
  const rallied = { ...steadied, movementLeft: 0, hasAttacked: true };
  return {
    unit: rallied,
    events: [{ type: 'UnitRallied', unitId: unit.id }, moraleChanged(rallied)],
  };
}

/** A routing unit the enemy caught up with leaves the battlefield for good. */
function flee(unit: FieldedUnit): UnitChange {
  return {
    unit: { ...unit, status: 'fled', pos: null, movementLeft: 0 },
    events: [{ type: 'UnitFled', unitId: unit.id, hex: unit.pos }],
  };
}

/** Whether an enemy that still fights stands next to the unit. */
function isPursued(state: BattleState, unit: FieldedUnit): boolean {
  return adjacentUnits(state, unit.pos, opponentOf(unit.owner)).some(isFighting);
}
