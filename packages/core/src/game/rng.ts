/**
 * Seeded random number generator kept in the battle state, so the same state and the same
 * commands always give the same result. Both numbers are unsigned 32-bit integers.
 */
export interface RngState {
  /** The seed the battle started with; kept so a replay can start from the beginning. */
  readonly seed: number;
  /** Changes with every number drawn. */
  readonly state: number;
}

/** A drawn value together with the generator to use for the next draw. */
export interface Draw<T> {
  readonly value: T;
  readonly rng: RngState;
}

const UINT32_RANGE = 0x1_0000_0000;
/** Step of the mulberry32 generator. */
const MULBERRY32_INCREMENT = 0x6d2b79f5;

export function createRng(seed: number): RngState {
  if (!Number.isInteger(seed)) {
    throw new Error(`Seed must be an integer, got ${seed}`);
  }
  const unsignedSeed = seed >>> 0;
  return { seed: unsignedSeed, state: unsignedSeed };
}

/** Draws a number from 0 (inclusive) to 1 (exclusive). */
export function nextRandom(rng: RngState): Draw<number> {
  const state = (rng.state + MULBERRY32_INCREMENT) >>> 0;
  let mixed = Math.imul(state ^ (state >>> 15), state | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  return { value, rng: { seed: rng.seed, state } };
}

/** Draws an integer from `min` to `max`, both included. */
export function nextRandomInt(rng: RngState, min: number, max: number): Draw<number> {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`Invalid integer range: ${min} to ${max}`);
  }
  const draw = nextRandom(rng);
  return { value: min + Math.floor(draw.value * (max - min + 1)), rng: draw.rng };
}
