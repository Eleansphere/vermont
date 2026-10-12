import type { AiState, Decision } from '@vermont/ai';
import type { BattleDefs, PlayerView } from '@vermont/core';

/** What the game asks of the worker the computer player thinks in. */
export type BrainRequest =
  | { readonly type: 'begin'; readonly defs: BattleDefs }
  | {
      readonly type: 'decide';
      readonly id: number;
      readonly view: PlayerView;
      readonly ai: AiState;
    };

/** The worker's answer to the `decide` request with the same id. */
export type BrainResponse =
  | { readonly id: number; readonly decision: Decision }
  | { readonly id: number; readonly error: string };
