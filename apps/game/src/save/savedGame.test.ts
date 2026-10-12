import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from '@vermont/core';
import type { SaveProblem, SavedGame } from './savedGame';
import { SAVE_FORMAT, SaveError, createSavedGame, parseSavedGame } from './savedGame';

const SAVED: SavedGame = createSavedGame({
  scenarioId: 'trebia',
  seed: 1_760_000_000_000,
  deployment: 'manual',
  fog: true,
  computer: { player: 1, state: { difficulty: 'hard', rng: { seed: 9, state: 123 } } },
  commands: [
    { type: 'DeployUnit', unitId: 'p0-hastati-1', hex: { q: 3, r: 9 } },
    { type: 'EndDeployment' },
  ],
});

function problemOf(json: string): SaveProblem | null {
  try {
    parseSavedGame(json);
    return null;
  } catch (error) {
    if (error instanceof SaveError) return error.problem;
    throw error;
  }
}

const saveWith = (changes: Record<string, unknown>) => JSON.stringify({ ...SAVED, ...changes });

describe('saved game', () => {
  it('records the format and the rules it was made with', () => {
    expect(SAVED).toMatchObject({
      game: 'vermont',
      format: SAVE_FORMAT,
      rulesVersion: RULES_VERSION,
    });
  });

  it('comes back from text unchanged', () => {
    expect(parseSavedGame(JSON.stringify(SAVED))).toEqual(SAVED);
    expect(parseSavedGame(saveWith({ computer: null })).computer).toBeNull();
  });

  it.each(['', 'not json', 'null', '[]', '{}', '{"game":"chess"}'])(
    'does not take %j for a save',
    (text) => {
      expect(problemOf(text)).toBe('unreadable');
    }
  );

  it('refuses a save of another version of the rules or of the format', () => {
    expect(problemOf(saveWith({ rulesVersion: RULES_VERSION - 1 }))).toBe('otherVersion');
    expect(problemOf(saveWith({ format: SAVE_FORMAT + 1 }))).toBe('otherVersion');
    expect(problemOf(saveWith({ rulesVersion: undefined }))).toBe('otherVersion');
  });

  it.each<[string, Record<string, unknown>]>([
    ['scenarioId', { scenarioId: 7 }],
    ['seed', { seed: 1.5 }],
    ['deployment', { deployment: 'random' }],
    ['fog', { fog: 'yes' }],
    ['commands', { commands: 'EndTurn' }],
    ['commands', { commands: [null] }],
    ['computer', { computer: undefined }],
    ['computer', { computer: { player: 2, state: SAVED.computer!.state } }],
    ['computer.state.difficulty', { computer: { player: 0, state: { difficulty: 'brutal' } } }],
    ['computer.state.rng', { computer: { player: 0, state: { difficulty: 'easy', rng: {} } } }],
  ])('names the damaged field %s', (field, changes) => {
    expect(problemOf(saveWith(changes))).toBe('damaged');
    expect(() => parseSavedGame(saveWith(changes))).toThrow(`${field} must be`);
  });
});
