import { describe, expect, it } from 'vitest';
import { FACTIONS, SCENARIOS, UNIT_TYPES } from '@vermont/core';
import { cs } from './cs';
import { factionName, plural, scenarioName, t, unitTypeName } from './index';

describe('i18n', () => {
  it('fills the placeholders in', () => {
    expect(t('hud.round', { turn: 4 })).toBe('Kolo 4');
    expect(t('hud.army.fighting', { count: 9, total: 12 })).toBe('v boji 9 z 12');
  });

  it('leaves a placeholder it has no value for', () => {
    expect(t('hud.round')).toBe('Kolo {turn}');
    expect(t('hud.round', { other: 1 })).toBe('Kolo {turn}');
  });

  it.each([
    [1, 'hex'],
    [2, 'hexy'],
    [4, 'hexy'],
    [5, 'hexů'],
    [0, 'hexů'],
  ])('declines the word for %i things', (count, word) => {
    expect(plural('hexes', count)).toBe(word);
  });

  it('has a name for everything in the game data', () => {
    expect(Object.keys(cs.unitTypes).sort()).toEqual(Object.keys(UNIT_TYPES).sort());
    expect(Object.keys(cs.factions).sort()).toEqual(Object.keys(FACTIONS).sort());
    expect(Object.keys(cs.scenarios).sort()).toEqual(Object.keys(SCENARIOS).sort());
  });

  it('translates names by id and falls back to the name in the data', () => {
    expect(unitTypeName(UNIT_TYPES['war-elephants']!)).toBe('Váleční sloni');
    expect(factionName(FACTIONS.rome!)).toBe('Řím');
    expect(scenarioName(SCENARIOS.trebia!)).toBe('Trebia (218 př. n. l.)');
    expect(factionName({ id: 'toString', name: 'Macedon', unitTypes: [] })).toBe('Macedon');
  });
});
