import { describe, expect, it } from 'vitest';
import type { RngState } from './rng';
import { createRng, nextRandom, nextRandomInt } from './rng';

function drawMany(rng: RngState, count: number): number[] {
  const values: number[] = [];
  let current = rng;
  for (let index = 0; index < count; index++) {
    const draw = nextRandom(current);
    values.push(draw.value);
    current = draw.rng;
  }
  return values;
}

describe('rng', () => {
  it('gives the same numbers for the same seed', () => {
    expect(drawMany(createRng(42), 20)).toEqual(drawMany(createRng(42), 20));
  });

  it('gives different numbers for different seeds', () => {
    expect(drawMany(createRng(1), 5)).not.toEqual(drawMany(createRng(2), 5));
  });

  it('matches the reference mulberry32 sequence', () => {
    const values = drawMany(createRng(1), 3).map((value) => Math.round(value * 0x1_0000_0000));

    expect(values).toEqual([2693262067, 11749833, 2265367787]);
  });

  it('draws numbers from 0 up to, but not including, 1', () => {
    for (const value of drawMany(createRng(7), 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not change the generator it draws from', () => {
    const rng = createRng(5);
    const first = nextRandom(rng);

    expect(rng).toEqual({ seed: 5, state: 5 });
    expect(nextRandom(rng)).toEqual(first);
    expect(first.rng.seed).toBe(5);
    expect(first.rng.state).not.toBe(5);
  });

  it('keeps the state an unsigned 32-bit integer', () => {
    let rng = createRng(-1);
    expect(rng).toEqual({ seed: 0xffff_ffff, state: 0xffff_ffff });

    for (let index = 0; index < 100; index++) {
      rng = nextRandom(rng).rng;
      expect(Number.isInteger(rng.state)).toBe(true);
      expect(rng.state).toBeGreaterThanOrEqual(0);
      expect(rng.state).toBeLessThanOrEqual(0xffff_ffff);
    }
  });

  it('rejects a fractional seed', () => {
    expect(() => createRng(1.5)).toThrow('Seed');
  });

  it('draws integers across the whole range, both ends included', () => {
    const seen = new Set<number>();
    let rng = createRng(3);
    for (let index = 0; index < 200; index++) {
      const draw = nextRandomInt(rng, -1, 1);
      seen.add(draw.value);
      rng = draw.rng;
    }

    expect([...seen].sort((a, b) => a - b)).toEqual([-1, 0, 1]);
  });

  it('draws the only value of a one-number range', () => {
    expect(nextRandomInt(createRng(9), 4, 4).value).toBe(4);
  });

  it('rejects an empty or fractional integer range', () => {
    expect(() => nextRandomInt(createRng(1), 2, 1)).toThrow('range');
    expect(() => nextRandomInt(createRng(1), 0, 1.5)).toThrow('range');
  });
});
