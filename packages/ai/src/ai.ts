import type { Command, RngState } from '@vermont/core';
import { createRng } from '@vermont/core';

/**
 * How well the computer plays. No level gets anything a human player does not have: they see
 * the same, roll the same dice and differ only in how they decide.
 */
export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/**
 * Everything a computer player carries from one decision to the next. Plain data, so it can be
 * saved with the battle and sent to a worker.
 */
export interface AiState {
  readonly difficulty: Difficulty;
  /** The AI's own dice; the battle's are hidden from it like from any player. */
  readonly rng: RngState;
}

/** One command the AI wants carried out, and the AI to ask for the next one. */
export interface Decision {
  readonly command: Command;
  readonly ai: AiState;
}

/** Keeps the AI's dice apart from the battle's, which start from the same seed. */
const AI_SEED_SALT = 0x5eed_a1;

/** A computer player for a battle started from `seed`; the same seed makes the same choices. */
export function createAi(difficulty: Difficulty, seed: number): AiState {
  return { difficulty, rng: createRng(seed ^ AI_SEED_SALT) };
}
