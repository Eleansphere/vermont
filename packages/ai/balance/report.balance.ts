import { it } from 'vitest';
import type { PlayerSlot } from '@vermont/core';
import { SCENARIOS } from '@vermont/core';
import type { Difficulty, Series } from '../src/index';
import { playSeries } from '../src/index';

/**
 * Prints how the shipped scenarios come out when the AIs fight them: `pnpm balance`.
 * `BALANCE_SEEDS` sets how many battles each line is counted from, `BALANCE_SCENARIO` keeps
 * the report to one scenario, `BALANCE_MATCHUP` (such as `hard-hard`) to one pair of levels.
 *
 * After who won and how many of the wins took the camp come the rounds the battles ended in, then the tempo: the round of the first
 * clash, the units destroyed and fled per battle, the share of its army the loser had lost two
 * rounds after the clash and the share the winner had left at the end.
 */
const SEED_COUNT = Number(process.env.BALANCE_SEEDS ?? 50);
const ONLY_SCENARIO = process.env.BALANCE_SCENARIO;
const ONLY_MATCHUP = process.env.BALANCE_MATCHUP;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, index) => index + 1);

const MATCHUPS = (
  [
    { 0: 'easy', 1: 'easy' },
    { 0: 'normal', 1: 'normal' },
    { 0: 'hard', 1: 'hard' },
    { 0: 'hard', 1: 'normal' },
    { 0: 'normal', 1: 'hard' },
  ] as const satisfies readonly Readonly<Record<PlayerSlot, Difficulty>>[]
).filter((levels) => !ONLY_MATCHUP || `${levels[0]}-${levels[1]}` === ONLY_MATCHUP);

function line(series: Series): string {
  const { scenarioId, levels, battles, wins, draws, campsTaken, rounds, tempo } = series;
  const percent = (part: number) => `${Math.round(part * 100)} %`.padStart(5);
  return [
    scenarioId.padEnd(8),
    `${levels[0]} v ${levels[1]}`.padEnd(16),
    `${wins[0]}:${wins[1]}`.padStart(6),
    percent(wins[0] / battles),
    String(draws).padStart(6),
    String(campsTaken).padStart(5),
    `${rounds.min}-${rounds.max}`.padStart(6),
    rounds.mean.toFixed(1).padStart(5),
    tempo.contactRound.toFixed(1).padStart(5),
    tempo.destroyed.toFixed(1).padStart(6),
    tempo.fled.toFixed(1).padStart(5),
    percent(tempo.loserOpeningLosses).padStart(7),
    percent(tempo.winnerLeft).padStart(6),
  ].join(' | ');
}

const scenarios = Object.values(SCENARIOS).filter(
  (scenario) => !ONLY_SCENARIO || scenario.id === ONLY_SCENARIO
);

it.each(scenarios)('balance of $id', { timeout: 0 }, (scenario) => {
  const lines = MATCHUPS.map((levels) => line(playSeries(scenario, levels, SEEDS)));
  console.log(
    [
      `scenario | first v second  |    1:2 | first | draws | camps | rounds |  mean | clash | killed |  fled | opening | winner   (${SEED_COUNT} seeds)`,
      ...lines,
    ].join('\n')
  );
});
