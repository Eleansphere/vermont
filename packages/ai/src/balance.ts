import type { PlayerSlot, ScenarioDef } from '@vermont/core';
import { startScenario } from '@vermont/core';
import type { Difficulty } from './ai';
import { createAi } from './ai';
import { simulateBattle } from './simulate';

/** Keeps the two players' dice apart when both start from the seed of the battle. */
const SECOND_PLAYER_SEED = 1000;

/** How a number of battles of one scenario between two AIs ended. */
export interface Series {
  readonly scenarioId: string;
  /** The level of the AI on each side. */
  readonly levels: Readonly<Record<PlayerSlot, Difficulty>>;
  readonly battles: number;
  readonly wins: Readonly<Record<PlayerSlot, number>>;
  /** Battles nobody won before the round limit, and those the AIs did not finish at all. */
  readonly draws: number;
  /** The round the shortest and the longest battle ended in, and the mean of all. */
  readonly rounds: { readonly min: number; readonly max: number; readonly mean: number };
}

/**
 * Lets two AIs fight the scenario once from every seed and counts who won. The same seeds give
 * the same series, so two versions of a scenario or of an AI can be compared battle by battle.
 */
export function playSeries(
  scenario: ScenarioDef,
  levels: Readonly<Record<PlayerSlot, Difficulty>>,
  seeds: readonly number[]
): Series {
  const wins: Record<PlayerSlot, number> = { 0: 0, 1: 0 };
  const rounds: number[] = [];
  for (const seed of seeds) {
    const { state } = simulateBattle(startScenario(scenario, seed), {
      0: createAi(levels[0], seed),
      1: createAi(levels[1], seed + SECOND_PLAYER_SEED),
    });
    if (state.winner) wins[state.winner.player]++;
    rounds.push(state.turn);
  }
  return {
    scenarioId: scenario.id,
    levels,
    battles: seeds.length,
    wins,
    draws: seeds.length - wins[0] - wins[1],
    rounds: {
      min: Math.min(...rounds),
      max: Math.max(...rounds),
      mean: rounds.reduce((sum, round) => sum + round, 0) / Math.max(rounds.length, 1),
    },
  };
}
