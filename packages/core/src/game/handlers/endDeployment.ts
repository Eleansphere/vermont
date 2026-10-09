import { FIRST_PLAYER, opponentOf } from '../battleState';
import type { CommandHandler, EndDeploymentCommand } from '../command';
import { reserveUnits } from '../deployment';

export const endDeployment: CommandHandler<EndDeploymentCommand> = {
  phases: ['deployment'],

  validate(state) {
    const waiting = reserveUnits(state, state.activePlayer).length;
    if (waiting === 0) return null;
    return {
      code: 'unitsNotDeployed',
      message: `Player ${state.activePlayer} still has ${waiting} units to deploy`,
    };
  },

  apply(state) {
    const done = state.activePlayer;
    const next = opponentOf(done);
    if (next !== FIRST_PLAYER) {
      return {
        state: { ...state, activePlayer: next },
        events: [{ type: 'DeploymentEnded', player: done }],
      };
    }
    // Both armies stand on the field: the player who deployed first also moves first.
    return {
      state: { ...state, phase: 'battle', activePlayer: FIRST_PLAYER },
      events: [
        { type: 'DeploymentEnded', player: done },
        { type: 'PhaseChanged', phase: 'battle' },
        { type: 'TurnStarted', player: FIRST_PLAYER, turn: state.turn },
      ],
    };
  },
};
