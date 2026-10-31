import { describe, expect, it } from 'vitest';
import { mapHexes, terrainAt } from '@vermont/core';
import { TerrainLabels } from './terrainLabels';
import { deployedTrebia } from './testSupport';

const { defs } = deployedTrebia();

describe('terrain labels', () => {
  it('labels every hex its terrain has a text for, and is hidden until asked', () => {
    const labels = new TerrainLabels(
      defs,
      () => 0,
      (terrain) => (terrain.id === 'plain' ? null : terrain.id)
    );
    const notPlain = mapHexes(defs.map).filter(
      (mapHex) => terrainAt(defs.map, defs.terrains, mapHex)?.id !== 'plain'
    );

    expect(labels.count).toBe(notPlain.length);
    expect(labels.shown).toBe(false);
    labels.show(true);
    expect(labels.shown).toBe(true);
  });

  it('has no labels without texts', () => {
    expect(
      new TerrainLabels(
        defs,
        () => 0,
        () => null
      ).count
    ).toBe(0);
  });
});
