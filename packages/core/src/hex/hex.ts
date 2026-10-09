/** Axial hex coordinate. The third cube axis is implied: `s = -q - r`. */
export interface Hex {
  readonly q: number;
  readonly r: number;
}

/** `"q,r"`: a hex as a string, for record keys and sets. */
export type HexKey = `${number},${number}`;

/**
 * The six neighbour offsets, counter-clockwise from east. Hexes are pointy-top, so `r` grows
 * downwards and a row of constant `r` is a straight horizontal line.
 */
export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, // east
  { q: 1, r: -1 }, // north-east
  { q: 0, r: -1 }, // north-west
  { q: -1, r: 0 }, // west
  { q: -1, r: 1 }, // south-west
  { q: 0, r: 1 }, // south-east
];

export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

/** Direction a ring starts from, so that walking the six directions in order closes it. */
const RING_START_DIRECTION: HexDirection = 4;

/**
 * Offset that pushes a line's end points off hex edges. A line running exactly along an edge
 * would otherwise round to either side unpredictably.
 */
const LINE_NUDGE: Hex = { q: 1e-6, r: 2e-6 };

/** Which of the two hexes a line picks when it runs exactly along their shared edge. */
export type LineSide = 1 | -1;

export function hex(q: number, r: number): Hex {
  return { q, r };
}

export function hexKey(a: Hex): HexKey {
  return `${a.q},${a.r}`;
}

export function parseHexKey(key: HexKey): Hex {
  const [q, r] = key.split(',').map(Number);
  if (q === undefined || r === undefined || !Number.isInteger(q) || !Number.isInteger(r)) {
    throw new Error(`Invalid hex key: "${key}"`);
  }
  return { q, r };
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexAdd(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexSubtract(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r };
}

export function hexScale(a: Hex, factor: number): Hex {
  return { q: a.q * factor, r: a.r * factor };
}

export function hexNeighbor(a: Hex, direction: HexDirection): Hex {
  return hexAdd(a, HEX_DIRECTIONS[direction]!);
}

export function hexNeighbors(a: Hex): Hex[] {
  return HEX_DIRECTIONS.map((direction) => hexAdd(a, direction));
}

/** Number of steps between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** Nearest hex to a fractional coordinate. */
export function hexRound(fractional: Hex): Hex {
  const fractionalS = -fractional.q - fractional.r;
  let q = Math.round(fractional.q);
  let r = Math.round(fractional.r);
  const s = Math.round(fractionalS);

  const qError = Math.abs(q - fractional.q);
  const rError = Math.abs(r - fractional.r);
  const sError = Math.abs(s - fractionalS);

  // The axis that rounded worst is recomputed from the other two.
  if (qError > rError && qError > sError) {
    q = -r - s;
  } else if (rError > sError) {
    r = -q - s;
  }
  // `+ 0` turns a negative zero into zero.
  return { q: q + 0, r: r + 0 };
}

/** All hexes exactly `radius` steps from the centre. */
export function hexRing(center: Hex, radius: number): Hex[] {
  assertRadius(radius);
  if (radius === 0) return [center];

  const ring: Hex[] = [];
  let current = hexAdd(center, hexScale(HEX_DIRECTIONS[RING_START_DIRECTION]!, radius));
  for (const direction of HEX_DIRECTIONS) {
    for (let step = 0; step < radius; step++) {
      ring.push(current);
      current = hexAdd(current, direction);
    }
  }
  return ring;
}

/** All hexes up to `radius` steps from the centre, ring by ring outwards. */
export function hexSpiral(center: Hex, radius: number): Hex[] {
  assertRadius(radius);
  const spiral: Hex[] = [];
  for (let ringRadius = 0; ringRadius <= radius; ringRadius++) {
    spiral.push(...hexRing(center, ringRadius));
  }
  return spiral;
}

/**
 * Hexes on the straight line from `a` to `b`, both ends included. Where the line runs exactly
 * along an edge between two hexes, `side` chooses which of the two is returned.
 */
export function hexLine(a: Hex, b: Hex, side: LineSide = 1): Hex[] {
  const steps = hexDistance(a, b);
  if (steps === 0) return [a];

  const nudge = hexScale(LINE_NUDGE, side);
  const from = hexAdd(a, nudge);
  const to = hexAdd(b, nudge);

  const line: Hex[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    line.push(hexRound({ q: from.q + (to.q - from.q) * t, r: from.r + (to.r - from.r) * t }));
  }
  return line;
}

function assertRadius(radius: number): void {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error(`Radius must be a non-negative integer, got ${radius}`);
  }
}
