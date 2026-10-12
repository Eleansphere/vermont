import { it } from 'vitest';
import type { PlayerSlot } from '@vermont/core';
import { SCENARIOS } from '@vermont/core';
import type { Difficulty, Series } from '../src/index';
import { playSeries } from '../src/index';

/**
 * Prints how the shipped scenarios come out when the AIs fight them: `pnpm balance`.
 * `BALANCE_SEEDS` sets how many battles each line is counted from, `BALANCE_SCENARIO` keeps
 * the report to one scenario.
 */
const SEED_COUNT = Number(process.env.BALANCE_SEEDS ?? 50);
const ONLY_SCENARIO = process.env.BALANCE_SCENARIO;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, index) => index + 1);

const MATCHUPS: readonly Readonly<Record<PlayerSlot, Difficulty>>[] = [
  { 0: 'easy', 1: 'easy' },
  { 0: 'normal', 1: 'normal' },
  { 0: 'hard', 1: 'hard' },
  { 0: 'hard', 1: 'normal' },
  { 0: 'normal', 1: 'hard' },
];

function line({ scenarioId, levels, battles, wins, draws, rounds }: Series): string {
  const share = (count: number) => `${Math.round((count / battles) * 100)} %`.padStart(5);
  return [
    scenarioId.padEnd(8),
    `${levels[0]} v ${levels[1]}`.padEnd(16),
    `${wins[0]}:${wins[1]}`.padStart(6),
    share(wins[0]),
    String(draws).padStart(6),
    `${rounds.min}-${rounds.max}`.padStart(6),
    rounds.mean.toFixed(1).padStart(5),
  ].join(' | ');
}

const scenarios = Object.values(SCENARIOS).filter(
  (scenario) => !ONLY_SCENARIO || scenario.id === ONLY_SCENARIO
);

it.each(scenarios)('balance of $id', { timeout: 0 }, (scenario) => {
  const lines = MATCHUPS.map((levels) => line(playSeries(scenario, levels, SEEDS)));
  console.log(
    [
      `scenario | first v second  |    1:2 | first | draws | rounds |  mean   (${SEED_COUNT} seeds)`,
      ...lines,
    ].join('\n')
  );
});
