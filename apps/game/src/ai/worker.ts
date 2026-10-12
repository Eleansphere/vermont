import { decide } from '@vermont/ai';
import type { BattleDefs } from '@vermont/core';
import type { BrainRequest, BrainResponse } from './protocol';

/** The part of the worker's global scope used here; the app is type-checked against the DOM. */
interface WorkerScope {
  onmessage: ((event: MessageEvent<BrainRequest>) => void) | null;
  postMessage(message: BrainResponse): void;
}

const scope = self as unknown as WorkerScope;
/** The battle being played; it stays the same object, which the AI's route cache relies on. */
let defs: BattleDefs | null = null;

scope.onmessage = ({ data }) => {
  if (data.type === 'begin') {
    defs = data.defs;
    return;
  }
  try {
    if (!defs) throw new Error('The AI was asked for a command before the battle began');
    scope.postMessage({ id: data.id, decision: decide(data.view, defs, data.ai) });
  } catch (error) {
    scope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
