import type { BattleDefs, PlayerView } from '@vermont/core';
import type { AiState, Decision, Difficulty } from './ai';
import { plannedDeployment } from './deployment';
import { randomDeployment, randomOrders } from './random';
import type { Tactics } from './tactics';
import { tacticalOrders } from './tactics';

/**
 * The two levels that think. The hard one judges a move by the attack it leads to, keeps its
 * army together, relieves worn units in the line, pulls shaken ones back to recover and sends a
 * rider for the enemy camp; it is also surer of its judgement. Both strike as soon as they can.
 */
const TACTICS: Readonly<Record<Exclude<Difficulty, 'easy'>, Tactics>> = {
  normal: {
    plan: { guard: true, raid: false, rest: false },
    relief: false,
    formation: false,
    looksAhead: false,
    misjudgement: 0.6,
  },
  hard: {
    plan: { guard: true, raid: true, rest: true },
    relief: true,
    formation: true,
    looksAhead: true,
    misjudgement: 0.3,
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
  if (state.phase === 'deployment') {
    return { command: plannedDeployment(state, defs, player), ai };
  }
  const draw = tacticalOrders(state, defs, player, TACTICS[ai.difficulty], ai.rng);
  return { command: draw.value, ai: { ...ai, rng: draw.rng } };
}
