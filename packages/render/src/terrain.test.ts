import { describe, expect, it } from 'vitest';
import { hexKey, mapHexes, rectangleHex } from '@vermont/core';
import { TERRAIN_STYLES } from './palette';
import { createTerrainLayer } from './terrain';
import { deployedTrebia } from './testSupport';

describe('terrain layer', () => {
  const { defs } = deployedTrebia();
  const terrain = createTerrainLayer(defs);

  it('draws every hex of the map with one mesh per terrain type', () => {
    const terrains = new Set(Object.values(defs.map.hexes).map((mapHex) => mapHex.terrain));
    const drawn = terrain.pickTargets.reduce((count, mesh) => count + mesh.count, 0);

    expect(terrain.pickTargets).toHaveLength(terrains.size);
    expect(drawn).toBe(mapHexes(defs.map).length);
  });

  it('knows which hex each instance draws', () => {
    const seen = new Set<string>();
    for (const mesh of terrain.pickTargets) {
      for (let instanceId = 0; instanceId < mesh.count; instanceId++) {
        seen.add(hexKey(terrain.hexOfInstance(mesh, instanceId)!));
      }
    }

    expect(seen).toEqual(new Set(Object.keys(defs.map.hexes)));
  });

  it('raises hills above the plain and sinks the river below it', () => {
    const plain = terrain.surfaceHeight(rectangleHex(0, 0));

    expect(plain).toBe(TERRAIN_STYLES.plain.height);
    expect(terrain.surfaceHeight(rectangleHex(4, 3))).toBeGreaterThan(plain);
    expect(terrain.surfaceHeight(rectangleHex(0, 5))).toBeLessThan(plain);
    expect(terrain.surfaceHeight(rectangleHex(-5, -5))).toBe(0);
  });

  it('has a style for every terrain in the data', () => {
    for (const terrainId of Object.keys(defs.terrains)) {
      expect(TERRAIN_STYLES).toHaveProperty(terrainId);
    }
  });
});
