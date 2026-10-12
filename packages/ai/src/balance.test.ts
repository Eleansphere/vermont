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

  it('measures how fast the battles went and what they cost', { timeout: 60_000 }, () => {
    const { rounds, tempo, wins, campsTaken } = playSeries(
      SCENARIOS.trebia!,
      { 0: 'normal', 1: 'normal' },
      SEEDS
    );

    expect(tempo.contactRound).toBeGreaterThanOrEqual(1);
    expect(tempo.contactRound).toBeLessThanOrEqual(rounds.mean);
    expect(tempo.roundsOfFighting).toBeCloseTo(rounds.mean - tempo.contactRound + 1);
    expect(tempo.destroyed + tempo.fled).toBeGreaterThan(0);
    expect(tempo.loserOpeningLosses).toBeGreaterThanOrEqual(0);
    expect(tempo.loserOpeningLosses).toBeLessThanOrEqual(1);
    expect(tempo.winnerLeft).toBeGreaterThan(0);
    expect(tempo.winnerLeft).toBeLessThanOrEqual(1);
    expect(campsTaken).toBeLessThanOrEqual(wins[0] + wins[1]);
  });

  it('gives the same series from the same seeds', { timeout: 60_000 }, () => {
    const levels = { 0: 'hard', 1: 'normal' } as const;

    expect(playSeries(SCENARIOS.zama!, levels, SEEDS)).toEqual(
      playSeries(SCENARIOS.zama!, levels, SEEDS)
    );
  });
});
