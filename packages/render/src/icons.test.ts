import { describe, expect, it } from 'vitest';
import type { Archetype } from '@vermont/core';
import { UNIT_TYPES } from '@vermont/core';
import { UNIT_ICONS, unitIcon } from './icons';

describe('unit icons', () => {
  it('has an icon for every archetype', () => {
    const archetypes = new Set<Archetype>(Object.values(UNIT_TYPES).map((type) => type.archetype));
    for (const archetype of archetypes) expect(UNIT_ICONS[archetype].length).toBeGreaterThan(0);
  });

  it('tells apart the types of one faction that share an archetype by pips', () => {
    expect(unitIcon(UNIT_TYPES, UNIT_TYPES.hastati!)).toEqual({
      archetype: 'heavyInfantry',
      pips: 0,
    });
    expect(unitIcon(UNIT_TYPES, UNIT_TYPES.principes!)).toEqual({
      archetype: 'heavyInfantry',
      pips: 1,
    });
    // The Gauls are the only heavy infantry of Carthage.
    expect(unitIcon(UNIT_TYPES, UNIT_TYPES['gallic-mercenaries']!).pips).toBe(0);
  });
});
