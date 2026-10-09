import { describe, expect, it } from 'vitest';
import { MAPS, hex, hexNeighbors, mapHexes } from '@vermont/core';
import {
  HEX_SIZE,
  HEX_WIDTH,
  boundsCenter,
  clampToBounds,
  groundBounds,
  hexToWorld,
  worldToHex,
} from './layout';

describe('hex layout', () => {
  it('puts the six neighbours of a hex at the same distance around it', () => {
    const center = hexToWorld(hex(2, -1));

    for (const neighbor of hexNeighbors(hex(2, -1))) {
      const point = hexToWorld(neighbor);
      expect(Math.hypot(point.x - center.x, point.z - center.z)).toBeCloseTo(HEX_WIDTH);
    }
  });

  it('lays rows out along x and moves south with r', () => {
    expect(hexToWorld(hex(1, 0))).toEqual({ x: HEX_WIDTH, z: 0 });
    expect(hexToWorld(hex(0, 1)).z).toBeCloseTo(1.5 * HEX_SIZE);
    expect(hexToWorld(hex(0, 1)).x).toBeCloseTo(HEX_WIDTH / 2);
  });

  it('finds the hex back from any point inside it', () => {
    for (const mapHex of mapHexes(MAPS.trebia!)) {
      const { x, z } = hexToWorld(mapHex);
      expect(worldToHex({ x, z })).toEqual(mapHex);
      expect(worldToHex({ x: x + 0.4 * HEX_WIDTH, z: z - 0.3 * HEX_SIZE })).toEqual(mapHex);
    }
  });

  it('bounds whole hexes', () => {
    const bounds = groundBounds([hex(0, 0), hex(1, 0)]);

    expect(bounds.minX).toBeCloseTo(-HEX_WIDTH / 2);
    expect(bounds.maxX).toBeCloseTo(1.5 * HEX_WIDTH);
    expect(bounds.minZ).toBeCloseTo(-HEX_SIZE);
    expect(bounds.maxZ).toBeCloseTo(HEX_SIZE);
    expect(boundsCenter(bounds).x).toBeCloseTo(HEX_WIDTH / 2);
  });

  it('clamps a point into the bounds', () => {
    const bounds = { minX: 0, maxX: 10, minZ: -5, maxZ: 5 };

    expect(clampToBounds({ x: 12, z: -9 }, bounds)).toEqual({ x: 10, z: -5 });
    expect(clampToBounds({ x: 3, z: 1 }, bounds)).toEqual({ x: 3, z: 1 });
  });
});
