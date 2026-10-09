import type { RngState } from './rng';
import { createRng } from './rng';

/** The two sides of a battle. */
export type PlayerSlot = 0 | 1;

export const PLAYER_SLOTS: readonly PlayerSlot[] = [0, 1];

export type Phase = 'deployment' | 'battle' | 'ended';

export const PHASES: readonly Phase[] = ['deployment', 'battle', 'ended'];

/**
 * Everything that changes during a battle. Plain data without methods or cycles, so saving is
 * `JSON.stringify`. It is never mutated: every command produces a new state.
 */
export interface BattleState {
  readonly scenarioId: string;
  readonly phase: Phase;
  /** Round number, starting at 1. Both players move once in every round. */
  readonly turn: number;
  readonly activePlayer: PlayerSlot;
  readonly rng: RngState;
}

export interface BattleOptions {
  readonly scenarioId: string;
  readonly seed: number;
  /** Phase the battle starts in; a battle normally starts by deploying the armies. */
  readonly phase?: Phase;
}

const FIRST_TURN = 1;
const FIRST_PLAYER: PlayerSlot = 0;

export function createBattle(options: BattleOptions): BattleState {
  return {
    scenarioId: options.scenarioId,
    phase: options.phase ?? 'deployment',
    turn: FIRST_TURN,
    activePlayer: FIRST_PLAYER,
    rng: createRng(options.seed),
  };
}

export function opponentOf(player: PlayerSlot): PlayerSlot {
  return player === 0 ? 1 : 0;
}
