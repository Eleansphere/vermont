import type { AiState } from '@vermont/ai';
import { DIFFICULTIES } from '@vermont/ai';
import type { Command, PlayerSlot } from '@vermont/core';
import { PLAYER_SLOTS, RULES_VERSION } from '@vermont/core';

/** Version of the save file itself; it changes when the fields below do. */
export const SAVE_FORMAT = 1;

const GAME = 'vermont';
const UINT32_MAX = 0xffff_ffff;

/** Who puts the armies on the map before the battle: the players, or the game for them. */
export type DeploymentMode = 'manual' | 'auto';

export const DEPLOYMENT_MODES: readonly DeploymentMode[] = ['manual', 'auto'];

/** The computer player of a saved battle, with its dice where they stopped. */
export interface SavedComputer {
  readonly player: PlayerSlot;
  readonly state: AiState;
}

/**
 * A battle that can be picked up later. It holds how the battle was started and every command
 * carried out since; the state is not saved, it comes from playing the commands again.
 */
export interface SavedGame {
  readonly game: typeof GAME;
  readonly format: number;
  readonly rulesVersion: number;
  readonly scenarioId: string;
  readonly seed: number;
  readonly deployment: DeploymentMode;
  readonly fog: boolean;
  /** `null` when two players share the screen. */
  readonly computer: SavedComputer | null;
  readonly commands: readonly Command[];
}

/** What a battle is saved from; the versions are filled in. */
export type SavedGameFields = Omit<SavedGame, 'game' | 'format' | 'rulesVersion'>;

export function createSavedGame(fields: SavedGameFields): SavedGame {
  return { game: GAME, format: SAVE_FORMAT, rulesVersion: RULES_VERSION, ...fields };
}

/**
 * Why a save cannot be loaded: it is not a save of this game at all, it was made by another
 * version of the game, or it is one of this version that does not hold together.
 */
export type SaveProblem = 'unreadable' | 'otherVersion' | 'damaged';

export class SaveError extends Error {
  constructor(
    readonly problem: SaveProblem,
    message: string
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

/** Reads a save back from text. Throws a `SaveError` when it cannot be loaded. */
export function parseSavedGame(json: string): SavedGame {
  let saved: unknown;
  try {
    saved = JSON.parse(json);
  } catch {
    throw new SaveError('unreadable', 'The save is not valid JSON');
  }
  if (!isRecord(saved) || saved.game !== GAME) {
    throw new SaveError('unreadable', 'The file is not a saved battle');
  }
  if (saved.format !== SAVE_FORMAT || saved.rulesVersion !== RULES_VERSION) {
    throw new SaveError(
      'otherVersion',
      `The save has format ${String(saved.format)} and rules version ` +
        `${String(saved.rulesVersion)}, expected ${SAVE_FORMAT} and ${RULES_VERSION}`
    );
  }

  const { scenarioId, seed, deployment, fog, commands } = saved;
  if (typeof scenarioId !== 'string') throw damaged('scenarioId', 'a string');
  if (!Number.isInteger(seed)) throw damaged('seed', 'an integer');
  if (!isOneOf(DEPLOYMENT_MODES, deployment)) {
    throw damaged('deployment', `one of ${DEPLOYMENT_MODES.join(', ')}`);
  }
  if (typeof fog !== 'boolean') throw damaged('fog', 'true or false');
  // What each command holds is checked by the core when the battle is played again.
  if (!Array.isArray(commands) || !commands.every(isRecord)) {
    throw damaged('commands', 'a list of commands');
  }
  return createSavedGame({
    scenarioId,
    seed: seed as number,
    deployment,
    fog,
    computer: readComputer(saved.computer),
    commands: commands as unknown as Command[],
  });
}

function readComputer(computer: unknown): SavedComputer | null {
  if (computer === null) return null;
  if (!isRecord(computer) || !isOneOf(PLAYER_SLOTS, computer.player)) {
    throw damaged('computer', 'a player and the state of its AI, or null');
  }
  const { state } = computer;
  if (!isRecord(state) || !isOneOf(DIFFICULTIES, state.difficulty)) {
    throw damaged('computer.state.difficulty', `one of ${DIFFICULTIES.join(', ')}`);
  }
  const { rng } = state;
  if (!isRecord(rng) || !isUint32(rng.seed) || !isUint32(rng.state)) {
    throw damaged('computer.state.rng', 'a seed and a state, both unsigned 32-bit integers');
  }
  return {
    player: computer.player,
    state: { difficulty: state.difficulty, rng: { seed: rng.seed, state: rng.state } },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

function isUint32(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= UINT32_MAX;
}

function damaged(field: string, expected: string): SaveError {
  return new SaveError('damaged', `The save is damaged: ${field} must be ${expected}`);
}
