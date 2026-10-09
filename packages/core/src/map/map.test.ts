import { describe, expect, it } from 'vitest';
import { TERRAINS } from '../data/terrains';
import { hex, hexDistance, hexKey } from '../hex/hex';
import { createMap, hasHex, mapHexes, paintTerrain, terrainAt } from './battleMap';
import { hexagonHexes, rectangleHexes } from './shapes';
import { terrainMoveCost } from './terrain';

describe('map shapes', () => {
  it('lays a rectangle out row by row from the top-left hex', () => {
    expect(rectangleHexes(3, 2)).toEqual([
      hex(0, 0),
      hex(1, 0),
      hex(2, 0),
      hex(0, 1),
      hex(1, 1),
      hex(2, 1),
    ]);
  });

  it('keeps the sides of a rectangle straight', () => {
    const hexes = rectangleHexes(4, 5);
    const rowStarts = [0, 1, 2, 3, 4].map((row) => hexes[row * 4]!);

    expect(hexes).toHaveLength(20);
    expect(rowStarts).toEqual([hex(0, 0), hex(0, 1), hex(-1, 2), hex(-1, 3), hex(-2, 4)]);
  });

  it('builds a hexagon around the origin', () => {
    const hexes = hexagonHexes(3);

    expect(hexes).toHaveLength(37);
    for (const mapHex of hexes) {
      expect(hexDistance(hex(0, 0), mapHex)).toBeLessThanOrEqual(3);
    }
  });

  it('rejects an empty or fractional rectangle', () => {
    expect(() => rectangleHexes(0, 3)).toThrow('Width');
    expect(() => rectangleHexes(3, 1.5)).toThrow('Height');
  });
});

describe('battle map', () => {
  const map = createMap('test', rectangleHexes(3, 2));

  it('starts as plain on every hex', () => {
    expect(mapHexes(map)).toEqual(rectangleHexes(3, 2));
    expect(terrainAt(map, TERRAINS, hex(1, 1))?.id).toBe('plain');
  });

  it('can start with another terrain', () => {
    const sea = createMap('sea', hexagonHexes(1), 'sea');

    expect(terrainAt(sea, TERRAINS, hex(0, 0))?.id).toBe('sea');
  });

  it('knows which hexes are on it', () => {
    expect(hasHex(map, hex(2, 1))).toBe(true);
    expect(hasHex(map, hex(3, 0))).toBe(false);
    expect(terrainAt(map, TERRAINS, hex(3, 0))).toBeUndefined();
  });

  it('paints terrain on a copy and leaves the original alone', () => {
    const painted = paintTerrain(map, 'forest', [hex(0, 0), hex(1, 0)]);

    expect(terrainAt(painted, TERRAINS, hex(0, 0))?.id).toBe('forest');
    expect(terrainAt(painted, TERRAINS, hex(1, 0))?.id).toBe('forest');
    expect(terrainAt(painted, TERRAINS, hex(2, 0))?.id).toBe('plain');
    expect(terrainAt(map, TERRAINS, hex(0, 0))?.id).toBe('plain');
  });

  it('refuses to paint a hex that is off the map', () => {
    expect(() => paintTerrain(map, 'forest', [hex(9, 9)])).toThrow('not on map "test"');
  });

  it('survives a round trip through JSON', () => {
    const painted = paintTerrain(map, 'hill', [hex(1, 1)]);

    expect(JSON.parse(JSON.stringify(painted))).toEqual(painted);
  });
});

describe('terrain', () => {
  it('lists every terrain under its own id', () => {
    for (const [id, terrain] of Object.entries(TERRAINS)) {
      expect(terrain.id).toBe(id);
    }
  });

  it('charges the base cost by default', () => {
    expect(terrainMoveCost(TERRAINS.plain, 'cavalry')).toBe(1);
    expect(terrainMoveCost(TERRAINS.forest, 'heavyInfantry')).toBe(2);
    expect(terrainMoveCost(TERRAINS.road, 'elephant')).toBe(0.5);
  });

  it('takes a bridge for open ground', () => {
    expect(terrainMoveCost(TERRAINS.bridge, 'elephant')).toBe(1);
    expect(TERRAINS.bridge).toMatchObject({ defenseBonus: 0, blocksSight: false });
    expect(TERRAINS.bridge.attackBonus).toBeUndefined();
  });

  it('lets nobody into water', () => {
    expect(terrainMoveCost(TERRAINS.river, 'lightInfantry')).toBeNull();
    expect(terrainMoveCost(TERRAINS.sea, 'cavalry')).toBeNull();
  });

  it('keeps cavalry and elephants out of the mountains', () => {
    expect(terrainMoveCost(TERRAINS.mountain, 'spear')).toBe(3);
    expect(terrainMoveCost(TERRAINS.mountain, 'cavalry')).toBeNull();
    expect(terrainMoveCost(TERRAINS.mountain, 'lightCavalry')).toBeNull();
    expect(terrainMoveCost(TERRAINS.mountain, 'elephant')).toBeNull();
  });

  it('lets an archetype pay its own price', () => {
    const thickForest = { ...TERRAINS.forest, moveCostFor: { cavalry: 3 } };

    expect(terrainMoveCost(thickForest, 'cavalry')).toBe(3);
    expect(terrainMoveCost(thickForest, 'spear')).toBe(2);
  });

  it('uses keys that match the hexes', () => {
    const map = createMap('keys', [hex(-1, 2)]);

    expect(Object.keys(map.hexes)).toEqual([hexKey(hex(-1, 2))]);
  });
});
