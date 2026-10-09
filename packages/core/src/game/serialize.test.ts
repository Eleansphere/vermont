import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from '../version';
import { createBattle } from './battleState';
import { deserializeBattle, serializeBattle } from './serialize';

const state = createBattle({ scenarioId: 'test', seed: 123, phase: 'battle' });

function saveWith(change: Record<string, unknown>): string {
  return JSON.stringify({ rulesVersion: RULES_VERSION, state: { ...state, ...change } });
}

describe('serialization', () => {
  it('saves the state together with the rules version', () => {
    expect(JSON.parse(serializeBattle(state))).toEqual({ rulesVersion: RULES_VERSION, state });
  });

  it('loads a saved state back unchanged', () => {
    expect(deserializeBattle(serializeBattle(state))).toEqual(state);
  });

  it('rejects text that is not JSON', () => {
    expect(() => deserializeBattle('not a save')).toThrow('not valid JSON');
  });

  it('rejects JSON that is not an object', () => {
    expect(() => deserializeBattle('[]')).toThrow('must be an object');
    expect(() => deserializeBattle('null')).toThrow('must be an object');
  });

  it('rejects a save from another version of the rules', () => {
    const old = JSON.stringify({ rulesVersion: RULES_VERSION + 1, state });

    expect(() => deserializeBattle(old)).toThrow(`expected ${RULES_VERSION}`);
    expect(() => deserializeBattle(JSON.stringify({ state }))).toThrow('rules version undefined');
  });

  it('rejects a save without a state', () => {
    expect(() => deserializeBattle(JSON.stringify({ rulesVersion: RULES_VERSION }))).toThrow(
      'state must be an object'
    );
  });

  it('names the damaged field', () => {
    expect(() => deserializeBattle(saveWith({ scenarioId: 5 }))).toThrow('state.scenarioId');
    expect(() => deserializeBattle(saveWith({ phase: 'siege' }))).toThrow('state.phase');
    expect(() => deserializeBattle(saveWith({ turn: 0 }))).toThrow('state.turn');
    expect(() => deserializeBattle(saveWith({ turn: 1.5 }))).toThrow('state.turn');
    expect(() => deserializeBattle(saveWith({ activePlayer: 2 }))).toThrow('state.activePlayer');
    expect(() => deserializeBattle(saveWith({ rng: null }))).toThrow('state.rng');
    expect(() => deserializeBattle(saveWith({ rng: { seed: 1, state: -1 } }))).toThrow('state.rng');
    expect(() => deserializeBattle(saveWith({ rng: { seed: 2 ** 32, state: 1 } }))).toThrow(
      'state.rng'
    );
  });

  it('drops fields the rules do not know', () => {
    expect(deserializeBattle(saveWith({ cheat: true }))).toEqual(state);
  });
});
