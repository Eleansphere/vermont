import { describe, expect, it } from 'vitest';
import {
  hex,
  hexAdd,
  hexDistance,
  hexEquals,
  hexKey,
  hexLine,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexRound,
  hexScale,
  hexSpiral,
  hexSubtract,
  parseHexKey,
} from './hex';
import type { HexKey } from './hex';

const ORIGIN = hex(0, 0);

function uniqueCount(hexes: readonly { q: number; r: number }[]): number {
  return new Set(hexes.map(hexKey)).size;
}

describe('hex keys', () => {
  it('round-trips a hex through its key', () => {
    expect(hexKey(hex(3, -2))).toBe('3,-2');
    expect(parseHexKey('3,-2')).toEqual(hex(3, -2));
  });

  it('rejects a malformed key', () => {
    expect(() => parseHexKey('3' as HexKey)).toThrow('Invalid hex key');
    expect(() => parseHexKey('a,b' as HexKey)).toThrow('Invalid hex key');
    expect(() => parseHexKey('1.5,2' as HexKey)).toThrow('Invalid hex key');
  });
});

describe('hex arithmetic', () => {
  it('adds, subtracts and scales', () => {
    expect(hexAdd(hex(1, 2), hex(3, -5))).toEqual(hex(4, -3));
    expect(hexSubtract(hex(1, 2), hex(3, -5))).toEqual(hex(-2, 7));
    expect(hexScale(hex(1, -2), 3)).toEqual(hex(3, -6));
  });

  it('compares by value', () => {
    expect(hexEquals(hex(1, 2), hex(1, 2))).toBe(true);
    expect(hexEquals(hex(1, 2), hex(2, 1))).toBe(false);
  });
});

describe('hex neighbours', () => {
  it('finds six different hexes one step away', () => {
    const neighbors = hexNeighbors(hex(2, -1));

    expect(uniqueCount(neighbors)).toBe(6);
    for (const neighbor of neighbors) {
      expect(hexDistance(hex(2, -1), neighbor)).toBe(1);
    }
  });

  it('keeps east and west on the same row', () => {
    expect(hexNeighbor(ORIGIN, 0)).toEqual(hex(1, 0));
    expect(hexNeighbor(ORIGIN, 3)).toEqual(hex(-1, 0));
  });

  it('puts opposite directions on opposite sides', () => {
    expect(hexAdd(hexNeighbor(ORIGIN, 1), hexNeighbor(ORIGIN, 4))).toEqual(ORIGIN);
    expect(hexAdd(hexNeighbor(ORIGIN, 2), hexNeighbor(ORIGIN, 5))).toEqual(ORIGIN);
  });
});

describe('hex distance', () => {
  it('counts steps along and across the axes', () => {
    expect(hexDistance(ORIGIN, ORIGIN)).toBe(0);
    expect(hexDistance(ORIGIN, hex(3, 0))).toBe(3);
    expect(hexDistance(ORIGIN, hex(3, -1))).toBe(3);
    expect(hexDistance(ORIGIN, hex(2, 2))).toBe(4);
  });

  it('is the same in both directions', () => {
    expect(hexDistance(hex(-2, 5), hex(4, -1))).toBe(hexDistance(hex(4, -1), hex(-2, 5)));
  });
});

describe('hex rounding', () => {
  it('snaps a fractional coordinate to the nearest hex', () => {
    expect(hexRound({ q: 0.4, r: 0.1 })).toEqual(ORIGIN);
    expect(hexRound({ q: 1.9, r: -1.1 })).toEqual(hex(2, -1));
  });

  it('never returns a negative zero', () => {
    const rounded = hexRound({ q: -0.2, r: -0.1 });

    expect(Object.is(rounded.q, 0)).toBe(true);
    expect(Object.is(rounded.r, 0)).toBe(true);
  });
});

describe('hex ring', () => {
  it('is just the centre at radius zero', () => {
    expect(hexRing(hex(1, 1), 0)).toEqual([hex(1, 1)]);
  });

  it('holds six hexes per unit of radius, all at that distance', () => {
    const center = hex(1, -2);
    const ring = hexRing(center, 3);

    expect(ring).toHaveLength(18);
    expect(uniqueCount(ring)).toBe(18);
    for (const ringHex of ring) {
      expect(hexDistance(center, ringHex)).toBe(3);
    }
  });

  it('walks around the centre one step at a time', () => {
    const ring = hexRing(ORIGIN, 2);

    ring.forEach((ringHex, index) => {
      const next = ring[(index + 1) % ring.length]!;
      expect(hexDistance(ringHex, next)).toBe(1);
    });
  });

  it('rejects a negative or fractional radius', () => {
    expect(() => hexRing(ORIGIN, -1)).toThrow('Radius');
    expect(() => hexRing(ORIGIN, 1.5)).toThrow('Radius');
  });
});

describe('hex spiral', () => {
  it('covers every hex within the radius exactly once, centre first', () => {
    const spiral = hexSpiral(hex(2, 2), 2);

    expect(spiral[0]).toEqual(hex(2, 2));
    expect(spiral).toHaveLength(19);
    expect(uniqueCount(spiral)).toBe(19);
    for (const spiralHex of spiral) {
      expect(hexDistance(hex(2, 2), spiralHex)).toBeLessThanOrEqual(2);
    }
  });
});

describe('hex line', () => {
  it('is a single hex when both ends are the same', () => {
    expect(hexLine(hex(1, 1), hex(1, 1))).toEqual([hex(1, 1)]);
  });

  it('follows a row', () => {
    expect(hexLine(ORIGIN, hex(3, 0))).toEqual([ORIGIN, hex(1, 0), hex(2, 0), hex(3, 0)]);
  });

  it('connects the ends with adjacent hexes and no detour', () => {
    const from = hex(-3, 1);
    const to = hex(4, -6);
    const line = hexLine(from, to);

    expect(line[0]).toEqual(from);
    expect(line.at(-1)).toEqual(to);
    expect(line).toHaveLength(hexDistance(from, to) + 1);
    for (let step = 1; step < line.length; step++) {
      expect(hexDistance(line[step - 1]!, line[step]!)).toBe(1);
    }
  });

  it('picks one hex per side where the line runs along an edge', () => {
    // The midpoint of (0,0)-(1,1) lies on the edge shared by (1,0) and (0,1).
    const oneSide = hexLine(ORIGIN, hex(1, 1), 1);
    const otherSide = hexLine(ORIGIN, hex(1, 1), -1);

    expect(oneSide).toEqual([ORIGIN, hex(0, 1), hex(1, 1)]);
    expect(otherSide).toEqual([ORIGIN, hex(1, 0), hex(1, 1)]);
  });
});
