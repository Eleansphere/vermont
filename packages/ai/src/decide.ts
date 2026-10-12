import type { BattleDefs, PlayerView } from '@vermont/core';
import type { AiState, Decision, Difficulty } from './ai';
import { plannedDeployment } from './deployment';
import { randomDeployment, randomOrders } from './random';
import type { Tactics } from './tactics';
import { tacticalOrders } from './tactics';

const TACTICS: Readonly<Record<Exclude<Difficulty, 'easy'>, Tactics>> = {
  normal: {
    plan: { guard: true, raid: false, withdraw: false },
    relief: false,
    wary: false,
    formation: false,
    attacksFirst: true,
  },
  hard: {
    plan: { guard: true, raid: true, withdraw: true },
    relief: true,
    wary: true,
    formation: true,
    attacksFirst: false,
  },
};

/**
 * The next command of the computer player whose view of the battle this is. It is asked again
 * after every command, with the view as it is then, until it ends its turn or deployment. It
 * gets what a human player sees and gives the same commands; nothing else of the battle
 * reaches it.
 */
export function decide(view: PlayerView, defs: BattleDefs, ai: AiState): Decision {
  const { state, player } = view;
  if (state.phase === 'ended' || state.activePlayer !== player) {
    throw new Error(`Player ${player} has no command to give: it is not on the move`);
  }
  if (ai.difficulty === 'easy') {
    const draw =
      state.phase === 'deployment'
        ? randomDeployment(state, defs, player, ai.rng)
        : randomOrders(state, defs, player, ai.rng);
    return { command: draw.value, ai: { ...ai, rng: draw.rng } };
  }
  const command =
    state.phase === 'deployment'
      ? plannedDeployment(state, defs, player)
      : tacticalOrders(state, defs, player, TACTICS[ai.difficulty]);
  return { command, ai };
}
