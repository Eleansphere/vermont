import { opponentOf } from '../battleState';
import type { CommandHandler, EndTurnCommand } from '../command';

/** The player who moves first in a round; when the move returns to them, a new round starts. */
const ROUND_OPENER = 0;

export const endTurn: CommandHandler<EndTurnCommand> = {
  phases: ['battle'],

  apply(state) {
    const nextPlayer = opponentOf(state.activePlayer);
    const nextTurn = nextPlayer === ROUND_OPENER ? state.turn + 1 : state.turn;
    return {
      state: { ...state, activePlayer: nextPlayer, turn: nextTurn },
      events: [
        { type: 'TurnEnded', player: state.activePlayer, turn: state.turn },
        { type: 'TurnStarted', player: nextPlayer, turn: nextTurn },
      ],
    };
  },
};
