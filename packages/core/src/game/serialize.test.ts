import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from '../version';
import { createBattle } from './battleState';
import { deserializeBattle, serializeBattle } from './serialize';
import { battleWith, place, withUnit } from './testSupport';

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

describe('serialization of units', () => {
  const fought = withUnit(
    withUnit(
      battleWith([
        place('hastati', 'hastati', 0, 0, 0),
        place('fallen', 'triarii', 0, 0, 1),
        place('gauls', 'gallic-mercenaries', 1, 2, -1),
      ]),
      'hastati',
      { hp: 4, morale: 3, moraleState: 'shaken', movementLeft: 1.5, spentAbilities: ['pilum'] }
    ),
    'fallen',
    { hp: 0, status: 'dead', pos: null }
  ).state;

  function saveWithUnit(change: Record<string, unknown>): string {
    const hastati = { ...fought.units.hastati, ...change };
    return saveWith({ units: { ...fought.units, hastati } });
  }

  it('loads the units back unchanged, in the same order', () => {
    const loaded = deserializeBattle(serializeBattle(fought));

    expect(loaded).toEqual(fought);
    expect(Object.keys(loaded.units)).toEqual(['hastati', 'fallen', 'gauls']);
  });

  it('keeps the winner of a finished battle', () => {
    const won = {
      ...fought,
      phase: 'ended',
      winner: { player: 1, reason: 'campCaptured' },
    } as const;

    expect(deserializeBattle(serializeBattle(won))).toEqual(won);
    expect(deserializeBattle(serializeBattle(fought))).not.toHaveProperty('winner');
  });

  it('rejects a save without units or with a damaged winner', () => {
    expect(() => deserializeBattle(saveWith({ units: undefined }))).toThrow('state.units');
    expect(() => deserializeBattle(saveWith({ units: [] }))).toThrow('state.units');
    expect(() => deserializeBattle(saveWith({ winner: { player: 2 } }))).toThrow('state.winner');
    expect(() =>
      deserializeBattle(saveWith({ winner: { player: 0, reason: 'surrender' } }))
    ).toThrow('state.winner');
  });

  it('names the damaged field of a unit', () => {
    const damaged: Array<[Record<string, unknown>, string]> = [
      [{ id: 'other' }, 'state.units.hastati.id'],
      [{ typeId: 7 }, 'state.units.hastati.typeId'],
      [{ owner: 2 }, 'state.units.hastati.owner'],
      [{ status: 'asleep' }, 'state.units.hastati.status'],
      [{ moraleState: 'happy' }, 'state.units.hastati.moraleState'],
      [{ pos: null }, 'state.units.hastati.pos'],
      [{ pos: { q: 0.5, r: 0 } }, 'state.units.hastati.pos'],
      [{ status: 'dead' }, 'state.units.hastati.pos'],
      [{ hp: -1 }, 'state.units.hastati.hp'],
      [{ morale: 'high' }, 'state.units.hastati.morale'],
      [{ movementLeft: null }, 'state.units.hastati.movementLeft'],
      [{ hasAttacked: 0 }, 'state.units.hastati.hasAttacked'],
      [{ hasRetreated: undefined }, 'state.units.hastati.hasRetreated'],
      [{ spentAbilities: 'pilum' }, 'state.units.hastati.spentAbilities'],
      [{ spentAbilities: [1] }, 'state.units.hastati.spentAbilities'],
    ];

    for (const [change, field] of damaged) {
      expect(() => deserializeBattle(saveWithUnit(change))).toThrow(`${field} must be`);
    }
    expect(() => deserializeBattle(saveWith({ units: { hastati: null } }))).toThrow(
      'state.units.hastati must be'
    );
  });
});
