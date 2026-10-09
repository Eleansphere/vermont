import type { Hex } from '../hex/hex';
import { hexSpiral } from '../hex/hex';

const MAP_CENTER: Hex = { q: 0, r: 0 };

/**
 * Hexes of a rectangle `width` hexes wide and `height` rows tall, row by row from the top-left
 * hex at (0, 0). Odd rows are shifted half a hex to the right, which keeps the sides straight.
 */
export function rectangleHexes(width: number, height: number): Hex[] {
  assertSize('Width', width);
  assertSize('Height', height);

  const hexes: Hex[] = [];
  for (let row = 0; row < height; row++) {
    const rowShift = Math.floor(row / 2);
    for (let column = 0; column < width; column++) {
      hexes.push({ q: column - rowShift, r: row });
    }
  }
  return hexes;
}

/** Hexes of a hexagon around (0, 0) reaching `radius` steps from it. */
export function hexagonHexes(radius: number): Hex[] {
  return hexSpiral(MAP_CENTER, radius);
}

function assertSize(name: string, size: number): void {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`${name} must be a positive integer, got ${size}`);
  }
}
