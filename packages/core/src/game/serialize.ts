import { RULES_VERSION } from '../version';
import type { BattleState, Phase, PlayerSlot } from './battleState';
import { PHASES, PLAYER_SLOTS } from './battleState';
import type { RngState } from './rng';

/** A saved battle: the state and the version of the rules it was played with. */
export interface SavedBattle {
  readonly rulesVersion: number;
  readonly state: BattleState;
}

const UINT32_MAX = 0xffff_ffff;

export function serializeBattle(state: BattleState): string {
  const saved: SavedBattle = { rulesVersion: RULES_VERSION, state };
  return JSON.stringify(saved);
}

/** Reads a saved battle back. Throws when the text is not a save of this version of the rules. */
export function deserializeBattle(json: string): BattleState {
  let saved: unknown;
  try {
    saved = JSON.parse(json);
  } catch {
    throw new Error('Saved battle is not valid JSON');
  }
  if (!isRecord(saved)) {
    throw new Error('Saved battle must be an object');
  }
  if (saved.rulesVersion !== RULES_VERSION) {
    throw new Error(
      `Saved battle has rules version ${String(saved.rulesVersion)}, expected ${RULES_VERSION}`
    );
  }
  return readState(saved.state);
}

function readState(state: unknown): BattleState {
  if (!isRecord(state)) {
    throw invalid('state', 'an object');
  }
  const { scenarioId, phase, turn, activePlayer } = state;
  if (typeof scenarioId !== 'string') {
    throw invalid('state.scenarioId', 'a string');
  }
  if (!(PHASES as readonly unknown[]).includes(phase)) {
    throw invalid('state.phase', `one of ${PHASES.join(', ')}`);
  }
  if (!Number.isInteger(turn) || (turn as number) < 1) {
    throw invalid('state.turn', 'a positive integer');
  }
  if (!(PLAYER_SLOTS as readonly unknown[]).includes(activePlayer)) {
    throw invalid('state.activePlayer', `one of ${PLAYER_SLOTS.join(', ')}`);
  }
  return {
    scenarioId,
    phase: phase as Phase,
    turn: turn as number,
    activePlayer: activePlayer as PlayerSlot,
    rng: readRng(state.rng),
  };
}

function readRng(rng: unknown): RngState {
  if (!isRecord(rng) || !isUint32(rng.seed) || !isUint32(rng.state)) {
    throw invalid('state.rng', 'a seed and a state, both unsigned 32-bit integers');
  }
  return { seed: rng.seed, state: rng.state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUint32(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= UINT32_MAX;
}

function invalid(field: string, expected: string): Error {
  return new Error(`Saved battle is damaged: ${field} must be ${expected}`);
}
