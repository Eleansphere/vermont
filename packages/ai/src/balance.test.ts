import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '@vermont/core';
import { playSeries } from './balance';

const SEEDS = [1, 2, 3];

describe('playSeries', () => {
  it('counts who won the battles of a scenario', { timeout: 60_000 }, () => {
    const series = playSeries(SCENARIOS.trebia!, { 0: 'normal', 1: 'easy' }, SEEDS);

    expect(series).toMatchObject({
      scenarioId: 'trebia',
      levels: { 0: 'normal', 1: 'easy' },
      battles: SEEDS.length,
    });
    expect(series.wins[0] + series.wins[1] + series.draws).toBe(SEEDS.length);
    expect(series.rounds.min).toBeGreaterThanOrEqual(1);
    expect(series.rounds.min).toBeLessThanOrEqual(series.rounds.mean);
    expect(series.rounds.mean).toBeLessThanOrEqual(series.rounds.max);
  });

  it('gives the same series from the same seeds', { timeout: 60_000 }, () => {
    const levels = { 0: 'hard', 1: 'normal' } as const;

    expect(playSeries(SCENARIOS.zama!, levels, SEEDS)).toEqual(
      playSeries(SCENARIOS.zama!, levels, SEEDS)
    );
  });
});
