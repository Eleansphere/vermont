import type { AiState, Decision } from '@vermont/ai';
import { decide } from '@vermont/ai';
import type { BattleDefs, PlayerView } from '@vermont/core';
import type { BrainRequest, BrainResponse } from './protocol';

/** Whatever works the computer player's commands out. It is told nothing but its own view. */
export interface AiBrain {
  /** Called once for every battle, before the first `decide`. */
  begin(defs: BattleDefs): void;
  decide(view: PlayerView, ai: AiState): Promise<Decision>;
  dispose(): void;
}

/** Thinks on the thread it is called from: for tests and where there are no workers. */
export function createLocalBrain(): AiBrain {
  let defs: BattleDefs | null = null;
  return {
    begin(battleDefs) {
      defs = battleDefs;
    },
    async decide(view, ai) {
      if (!defs) throw new Error('The AI was asked for a command before the battle began');
      return decide(view, defs, ai);
    },
    dispose() {
      defs = null;
    },
  };
}

interface Waiting {
  resolve(decision: Decision): void;
  reject(error: Error): void;
}

/** Thinks in a Web Worker, so that the battle on the screen never stutters. */
export function createWorkerBrain(): AiBrain {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const waiting = new Map<number, Waiting>();
  let nextId = 0;
  const post = (request: BrainRequest) => worker.postMessage(request);
  const fail = (error: Error) => {
    for (const { reject } of waiting.values()) reject(error);
    waiting.clear();
  };

  worker.onmessage = ({ data }: MessageEvent<BrainResponse>) => {
    const asked = waiting.get(data.id);
    if (!asked) return;
    waiting.delete(data.id);
    if ('decision' in data) asked.resolve(data.decision);
    else asked.reject(new Error(data.error));
  };
  worker.onerror = (event) => fail(new Error(event.message || 'The AI worker failed'));

  return {
    begin(defs) {
      post({ type: 'begin', defs });
    },
    decide(view, ai) {
      return new Promise<Decision>((resolve, reject) => {
        const id = nextId++;
        waiting.set(id, { resolve, reject });
        post({ type: 'decide', id, view, ai });
      });
    },
    dispose() {
      worker.terminate();
      fail(new Error('The AI was stopped'));
    },
  };
}

export function createBrain(): AiBrain {
  return typeof Worker === 'undefined' ? createLocalBrain() : createWorkerBrain();
}
