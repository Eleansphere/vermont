import { describe, expect, it } from 'vitest';
import type { PlayerSlot, ScenarioDef } from '@vermont/core';
import {
  SCENARIOS,
  dispatchAll,
  fieldedUnits,
  opponentOf,
  scenarioDefs,
  startScenario,
} from '@vermont/core';
import type { Difficulty } from './ai';
import { DIFFICULTIES, createAi } from './ai';
import type { SimulatedBattle } from './simulate';
import { simulateBattle } from './simulate';

const SEEDS = Array.from({ length: 20 }, (_, index) => index + 1);
/** Fewer battles where the point is only that the level plays to the end. */
const FEW_SEEDS = SEEDS.slice(0, 5);
const DUEL_SEEDS = SEEDS.slice(0, 10);
const REPLAY_SEED = 202;
/** Keeps the two players' dice apart when both start from the seed of the battle. */
const SECOND_PLAYER_SEED = 1000;
const TIMEOUT_MS = 120_000;

function battle(scenario: ScenarioDef, seed: number, first: Difficulty, second: Difficulty) {
  return simulateBattle(startScenario(scenario, seed), {
    0: createAi(first, seed),
    1: createAi(second, seed + SECOND_PLAYER_SEED),
  });
}

function expectDecided({ state, rejected }: SimulatedBattle): void {
  expect(rejected).toBe(0);
  expect(state.phase).toBe('ended');
  if (state.winner?.reason === 'armyBroken') {
    expect(fieldedUnits(state, opponentOf(state.winner.player))).toEqual([]);
  }
}

describe.each(Object.values(SCENARIOS))('AI against AI: $id', (scenario: ScenarioDef) => {
  it(
    'is fought to the end by the hard AI on both sides, from twenty seeds',
    { timeout: TIMEOUT_MS },
    () => {
      for (const seed of SEEDS) expectDecided(battle(scenario, seed, 'hard', 'hard'));
    }
  );

  it.each(DIFFICULTIES.filter((difficulty) => difficulty !== 'hard'))(
    'is fought to the end by the %s AI on both sides',
    { timeout: TIMEOUT_MS },
    (difficulty) => {
      for (const seed of FEW_SEEDS) expectDecided(battle(scenario, seed, difficulty, difficulty));
    }
  );

  it.each(['easy', 'normal'] as const)(
    'is won by the hard AI over the %s one more often than not',
    { timeout: TIMEOUT_MS },
    (weaker) => {
      let won = 0;
      for (const seed of DUEL_SEEDS) {
        for (const hardSide of [0, 1] as const satisfies readonly PlayerSlot[]) {
          const fought =
            hardSide === 0
              ? battle(scenario, seed, 'hard', weaker)
              : battle(scenario, seed, weaker, 'hard');
          expectDecided(fought);
          if (fought.state.winner?.player === hardSide) won++;
        }
      }
      expect(won).toBeGreaterThan(DUEL_SEEDS.length);
    }
  );

  it('plays out the same way again from the seed and the commands', () => {
    const fought = battle(scenario, REPLAY_SEED, 'hard', 'normal');

    const again = battle(scenario, REPLAY_SEED, 'hard', 'normal');
    const replay = dispatchAll(
      startScenario(scenario, REPLAY_SEED).state,
      fought.commands,
      scenarioDefs(scenario)
    );

    expect(again.commands).toEqual(fought.commands);
    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(fought.state);
  });
});
