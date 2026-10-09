import { describe, expect, it } from 'vitest';
import { TERRAINS } from '../data/terrains';
import { hex, hexKey } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { hexagonHexes, rectangleHexes } from '../map/shapes';
import type { SightContext } from './sight';
import { canSee, hasLineOfSight, rangeFrom, visibleHexes } from './sight';

const OPEN: SightContext = { terrains: TERRAINS };
const EYE = hex(0, 0);
const OBSTACLE = hex(2, 0);
const BEHIND = hex(3, 0);

/** A single row of plain hexes from (0,0) to (6,0). */
const row = createMap('row', rectangleHexes(7, 1));

describe('hasLineOfSight', () => {
  it('sees across open ground', () => {
    expect(hasLineOfSight(row, EYE, hex(6, 0), OPEN)).toBe(true);
  });

  it('sees a forest but not what is behind it', () => {
    const map = paintTerrain(row, 'forest', [OBSTACLE]);

    expect(hasLineOfSight(map, EYE, OBSTACLE, OPEN)).toBe(true);
    expect(hasLineOfSight(map, EYE, BEHIND, OPEN)).toBe(false);
  });

  it('always sees the hex next door', () => {
    const map = paintTerrain(row, 'forest', [EYE, hex(1, 0)]);

    expect(hasLineOfSight(map, EYE, hex(1, 0), OPEN)).toBe(true);
  });

  it('is blocked by a hill and by mountains', () => {
    expect(hasLineOfSight(paintTerrain(row, 'hill', [OBSTACLE]), EYE, BEHIND, OPEN)).toBe(false);
    expect(hasLineOfSight(paintTerrain(row, 'mountain', [OBSTACLE]), EYE, BEHIND, OPEN)).toBe(
      false
    );
  });

  it('is blocked by a unit standing in the way', () => {
    const context = { ...OPEN, units: new Set([hexKey(OBSTACLE)]) };

    expect(hasLineOfSight(row, EYE, OBSTACLE, context)).toBe(true);
    expect(hasLineOfSight(row, EYE, BEHIND, context)).toBe(false);
  });

  it('sees over forests and units from a hill', () => {
    const map = paintTerrain(paintTerrain(row, 'hill', [EYE]), 'forest', [OBSTACLE]);
    const context = { ...OPEN, units: new Set([hexKey(hex(1, 0))]) };

    expect(hasLineOfSight(map, EYE, BEHIND, context)).toBe(true);
    // The other way round the observer is on low ground, so the forest is in the way.
    expect(hasLineOfSight(map, BEHIND, EYE, context)).toBe(false);
  });

  it('does not see over another hill or mountains even from a hill', () => {
    const onHill = paintTerrain(row, 'hill', [EYE]);

    expect(hasLineOfSight(paintTerrain(onHill, 'hill', [OBSTACLE]), EYE, BEHIND, OPEN)).toBe(false);
    expect(hasLineOfSight(paintTerrain(onHill, 'mountain', [OBSTACLE]), EYE, BEHIND, OPEN)).toBe(
      false
    );
  });

  it('needs both hexes blocked when the line runs along their shared edge', () => {
    // The line (0,0)-(1,1) runs between (1,0) and (0,1).
    const map = createMap('open', hexagonHexes(2));
    const oneForest = paintTerrain(map, 'forest', [hex(1, 0)]);
    const twoForests = paintTerrain(map, 'forest', [hex(1, 0), hex(0, 1)]);

    expect(hasLineOfSight(oneForest, EYE, hex(1, 1), OPEN)).toBe(true);
    expect(hasLineOfSight(twoForests, EYE, hex(1, 1), OPEN)).toBe(false);
  });

  it('sees nothing off the map', () => {
    expect(hasLineOfSight(row, EYE, hex(0, 5), OPEN)).toBe(false);
    expect(hasLineOfSight(row, hex(0, 5), EYE, OPEN)).toBe(false);
  });
});

describe('sight range', () => {
  const hillRow = paintTerrain(row, 'hill', [EYE]);

  it('grows by one on a hill', () => {
    expect(rangeFrom(row, EYE, 3, TERRAINS)).toBe(3);
    expect(rangeFrom(hillRow, EYE, 3, TERRAINS)).toBe(4);
  });

  it('limits what canSee reports', () => {
    expect(canSee(row, EYE, hex(3, 0), 3, OPEN)).toBe(true);
    expect(canSee(row, EYE, hex(4, 0), 3, OPEN)).toBe(false);
    expect(canSee(hillRow, EYE, hex(4, 0), 3, OPEN)).toBe(true);
  });
});

describe('visibleHexes', () => {
  it('lists the hexes on the map within range, the observer first', () => {
    expect(visibleHexes(row, EYE, 3, OPEN)).toEqual([EYE, hex(1, 0), hex(2, 0), hex(3, 0)]);
  });

  it('sees the whole neighbourhood on open ground', () => {
    const map = createMap('open', hexagonHexes(4));

    expect(visibleHexes(map, EYE, 2, OPEN)).toHaveLength(19);
  });

  it('leaves out what is hidden behind an obstacle', () => {
    const map = paintTerrain(row, 'forest', [OBSTACLE]);

    expect(visibleHexes(map, EYE, 5, OPEN)).toEqual([EYE, hex(1, 0), OBSTACLE]);
  });

  it('reaches one hex further from a hill', () => {
    const map = paintTerrain(row, 'hill', [EYE]);

    expect(visibleHexes(map, EYE, 3, OPEN)).toHaveLength(5);
  });

  it('is empty for an observer off the map', () => {
    expect(visibleHexes(row, hex(0, 5), 3, OPEN)).toEqual([]);
  });
});
