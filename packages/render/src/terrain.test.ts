import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'three';
import type { InstancedMesh } from 'three';
import { hexKey, mapHexes, rectangleHex } from '@vermont/core';
import { TERRAIN_STYLES } from './palette';
import { createTerrainLayer } from './terrain';
import { fakeTerrainKit } from './kit/testKit';
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

  it('darkens the hexes in the fog, with the trees on them, and lights them again', () => {
    const fogged = createTerrainLayer(defs);
    const lit = rectangleHex(0, 0);
    const wood = rectangleHex(11, 3);
    const brightness = () =>
      fogged.object.children.map((mesh) => {
        const colors = (mesh as InstancedMesh).instanceColor!.array;
        return Array.from(colors).reduce((sum, channel) => sum + channel, 0);
      });
    const clear = brightness();

    fogged.setFog(new Set([hexKey(lit)]));

    expect(fogged.isFogged(lit)).toBe(false);
    expect(fogged.isFogged(wood)).toBe(true);
    brightness().forEach((sum, index) => expect(sum).toBeLessThan(clear[index]!));

    fogged.setFog(null);

    expect(fogged.isFogged(wood)).toBe(false);
    expect(brightness()).toEqual(clear);
  });

  it('has a style for every terrain in the data', () => {
    for (const terrainId of Object.keys(defs.terrains)) {
      expect(TERRAIN_STYLES).toHaveProperty(terrainId);
    }
  });

  describe('with the model kit', () => {
    const kitted = createTerrainLayer(defs, fakeTerrainKit());
    const topOf = (mesh: InstancedMesh, index: number) => {
      const matrix = new Matrix4();
      mesh.getMatrixAt(index, matrix);
      mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox!.max.clone().applyMatrix4(matrix).y;
    };

    it('still draws one mesh per terrain type, with every hex picked as before', () => {
      const drawn = kitted.pickTargets.reduce((count, mesh) => count + mesh.count, 0);

      expect(drawn).toBe(mapHexes(defs.map).length);
      expect(kitted.pickTargets).toHaveLength(terrain.pickTargets.length);
    });

    it('puts the top of every tile at the height units stand on', () => {
      for (const mesh of kitted.pickTargets) {
        for (let index = 0; index < mesh.count; index++) {
          const target = kitted.hexOfInstance(mesh, index)!;
          expect(topOf(mesh, index)).toBeCloseTo(kitted.surfaceHeight(target));
        }
      }
    });

    it('decorates the forests, the camps and the roads', () => {
      const decorations = kitted.object.children.length - kitted.pickTargets.length;

      expect(decorations).toBeGreaterThanOrEqual(3);
    });

    it('darkens the tiles and what stands on them in the fog', () => {
      const sums = () =>
        kitted.object.children.map((mesh) =>
          Array.from((mesh as InstancedMesh).instanceColor!.array).reduce((sum, c) => sum + c, 0)
        );
      const clear = sums();

      kitted.setFog(new Set());

      sums().forEach((sum, index) => expect(sum).toBeLessThan(clear[index]!));
      kitted.setFog(null);
    });
  });
});
