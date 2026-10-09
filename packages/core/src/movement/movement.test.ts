import { describe, expect, it } from 'vitest';
import { TERRAINS } from '../data/terrains';
import type { Hex, HexKey } from '../hex/hex';
import { hex, hexDistance, hexKey } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { hexagonHexes, rectangleHexes } from '../map/shapes';
import { MinHeap } from './minHeap';
import type { MoveContext } from './movement';
import { findPath, pathFromReach, reachableHexes, zoneOfControl } from './movement';

const INFANTRY: MoveContext = { terrains: TERRAINS, archetype: 'heavyInfantry' };
const CAVALRY: MoveContext = { terrains: TERRAINS, archetype: 'cavalry' };
const START = hex(0, 0);

/** A single row of plain hexes from (0,0) to (length - 1, 0). */
function rowMap(length: number) {
  return createMap('row', rectangleHexes(length, 1));
}

function keys(...hexes: Hex[]): Set<HexKey> {
  return new Set(hexes.map(hexKey));
}

describe('MinHeap', () => {
  it('returns the lowest priority first', () => {
    const heap = new MinHeap<string>();
    heap.push('c', 3);
    heap.push('a', 1);
    heap.push('d', 4);
    heap.push('b', 2);

    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual(['a', 'b', 'c', 'd']);
    expect(heap.size).toBe(0);
    expect(heap.pop()).toBeUndefined();
  });

  it('returns equal priorities in the order they were pushed', () => {
    const heap = new MinHeap<string>();
    for (const item of ['first', 'second', 'third', 'fourth']) heap.push(item, 1);

    expect([heap.pop(), heap.pop(), heap.pop(), heap.pop()]).toEqual([
      'first',
      'second',
      'third',
      'fourth',
    ]);
  });
});

describe('reachableHexes', () => {
  it('reaches every plain hex within the movement points', () => {
    const map = createMap('open', hexagonHexes(4));

    const reach = reachableHexes(map, START, 2, INFANTRY);

    expect(reach.size).toBe(19);
    for (const node of reach.values()) {
      expect(node.cost).toBe(hexDistance(START, node.hex));
    }
  });

  it('includes the starting hex at no cost', () => {
    const reach = reachableHexes(rowMap(3), START, 0, INFANTRY);

    expect([...reach.values()]).toEqual([{ hex: START, cost: 0, from: null, canStop: true }]);
  });

  it('does not enter a hex the unit cannot fully pay for', () => {
    const map = paintTerrain(rowMap(3), 'forest', [hex(1, 0)]);

    expect(reachableHexes(map, START, 1, INFANTRY).has('1,0')).toBe(false);
    expect(reachableHexes(map, START, 2, INFANTRY).get('1,0')?.cost).toBe(2);
  });

  it('moves twice as far along a road', () => {
    const map = createMap('road', rectangleHexes(6, 1), 'road');

    const reach = reachableHexes(map, START, 2, INFANTRY);

    expect(reach.get('4,0')?.cost).toBe(2);
    expect(reach.has('5,0')).toBe(false);
  });

  it('stops at water', () => {
    const map = paintTerrain(rowMap(4), 'river', [hex(1, 0)]);

    expect(reachableHexes(map, START, 10, INFANTRY).size).toBe(1);
  });

  it('lets infantry over mountains but not cavalry', () => {
    const map = paintTerrain(rowMap(3), 'mountain', [hex(1, 0)]);

    expect(reachableHexes(map, START, 10, INFANTRY).get('2,0')?.cost).toBe(4);
    expect(reachableHexes(map, START, 10, CAVALRY).has('1,0')).toBe(false);
  });

  it('cannot enter a hex held by the enemy', () => {
    const context = { ...INFANTRY, enemy: keys(hex(1, 0)) };

    expect(reachableHexes(rowMap(3), START, 10, context).size).toBe(1);
  });

  it('passes through its own units but cannot stop on them', () => {
    const context = { ...INFANTRY, friendly: keys(hex(1, 0)) };

    const reach = reachableHexes(rowMap(3), START, 10, context);

    expect(reach.get('1,0')?.canStop).toBe(false);
    expect(reach.get('2,0')).toMatchObject({ cost: 2, canStop: true });
    expect(pathFromReach(reach, hex(1, 0))).toBeNull();
    expect(pathFromReach(reach, hex(2, 0))?.hexes).toEqual([START, hex(1, 0), hex(2, 0)]);
  });

  it('returns nothing when the start is off the map', () => {
    expect(reachableHexes(rowMap(3), hex(9, 9), 5, INFANTRY).size).toBe(0);
  });
});

describe('zone of control', () => {
  const map = rowMap(7);
  const enemyHex = hex(3, 0);
  const context: MoveContext = {
    ...INFANTRY,
    enemy: keys(enemyHex),
    zoneOfControl: zoneOfControl(map, [enemyHex]),
  };

  it('covers the hexes next to an enemy that are on the map', () => {
    expect(zoneOfControl(map, [enemyHex])).toEqual(keys(hex(2, 0), hex(4, 0)));
    expect(zoneOfControl(createMap('open', hexagonHexes(2)), [START]).size).toBe(6);
  });

  it('stops a unit that walks into it', () => {
    const open = createMap('open', hexagonHexes(3));
    const openContext: MoveContext = {
      ...INFANTRY,
      enemy: keys(START),
      zoneOfControl: zoneOfControl(open, [START]),
    };

    const reach = reachableHexes(open, hex(-2, 0), 10, openContext);

    // Slipping past the enemy would need a second step inside its zone.
    expect(reach.get('-1,0')).toMatchObject({ cost: 1, canStop: true });
    expect(reach.get('0,-1')?.from).not.toEqual(hex(-1, 0));
    expect(reach.get('1,0')?.cost).toBe(6);
  });

  it('cannot be crossed in a corridor', () => {
    const reach = reachableHexes(map, START, 10, context);

    expect([...reach.keys()]).toEqual(['0,0', '1,0', '2,0']);
  });

  it('lets a unit that starts inside it walk away', () => {
    const reach = reachableHexes(map, hex(2, 0), 10, context);

    expect(reach.get('0,0')?.cost).toBe(2);
  });

  it('closes a hex held by a friendly unit, where the mover could not stop', () => {
    const blocked = { ...context, friendly: keys(hex(2, 0)) };

    expect([...reachableHexes(map, START, 10, blocked).keys()]).toEqual(['0,0', '1,0']);
  });
});

describe('findPath', () => {
  it('goes straight across open ground', () => {
    const path = findPath(rowMap(5), START, hex(4, 0), INFANTRY);

    expect(path).toEqual({
      hexes: [START, hex(1, 0), hex(2, 0), hex(3, 0), hex(4, 0)],
      cost: 4,
    });
  });

  it('stays put when the goal is the start', () => {
    expect(findPath(rowMap(3), START, START, INFANTRY)).toEqual({ hexes: [START], cost: 0 });
  });

  it('walks around a forest when that is cheaper', () => {
    const forest = [hex(1, 0), hex(2, 0), hex(3, 0)];
    const map = paintTerrain(createMap('detour', rectangleHexes(5, 2)), 'forest', forest);

    const path = findPath(map, START, hex(4, 0), INFANTRY);

    expect(path).toEqual({
      hexes: [START, hex(0, 1), hex(1, 1), hex(2, 1), hex(3, 1), hex(4, 0)],
      cost: 5,
    });
  });

  it('takes the longer way round when it runs along a road', () => {
    const road = [hex(0, 1), hex(1, 1), hex(2, 1), hex(3, 1)];
    const map = paintTerrain(createMap('road', rectangleHexes(5, 2)), 'road', road);

    expect(findPath(map, START, hex(4, 0), INFANTRY)?.cost).toBe(3);
  });

  it('goes through its own units', () => {
    const context = { ...INFANTRY, friendly: keys(hex(1, 0)) };

    expect(findPath(rowMap(3), START, hex(2, 0), context)?.hexes).toEqual([
      START,
      hex(1, 0),
      hex(2, 0),
    ]);
  });

  it('finds no path to a hex it cannot stop on or reach', () => {
    const map = paintTerrain(rowMap(5), 'river', [hex(2, 0)]);
    const occupied = { ...INFANTRY, friendly: keys(hex(1, 0)) };

    expect(findPath(map, START, hex(4, 0), INFANTRY)).toBeNull();
    expect(findPath(map, START, hex(2, 0), INFANTRY)).toBeNull();
    expect(findPath(map, START, hex(1, 0), occupied)).toBeNull();
    expect(findPath(map, START, hex(9, 9), INFANTRY)).toBeNull();
    expect(findPath(map, hex(9, 9), START, INFANTRY)).toBeNull();
  });

  it('gives up when the path would cost more than allowed', () => {
    expect(findPath(rowMap(5), START, hex(4, 0), INFANTRY, 3)).toBeNull();
    expect(findPath(rowMap(5), START, hex(4, 0), INFANTRY, 4)?.cost).toBe(4);
  });

  it('agrees with reachableHexes on the cost of every hex of a mixed map', () => {
    let map = createMap('mixed', hexagonHexes(4));
    map = paintTerrain(map, 'forest', [hex(1, 0), hex(1, 1), hex(0, 2), hex(-2, 1)]);
    map = paintTerrain(map, 'road', [hex(0, -1), hex(1, -2), hex(2, -3), hex(3, -3), hex(-1, 0)]);
    map = paintTerrain(map, 'river', [hex(2, 0), hex(2, -1), hex(-1, 2), hex(-2, 3)]);
    map = paintTerrain(map, 'hill', [hex(-1, -1), hex(-2, 0)]);
    map = paintTerrain(map, 'marsh', [hex(3, 0), hex(0, 3)]);

    const reach = reachableHexes(map, START, Infinity, INFANTRY);

    expect(reach.size).toBe(61 - 4);
    for (const node of reach.values()) {
      expect(findPath(map, START, node.hex, INFANTRY)?.cost).toBe(node.cost);
    }
  });
});
