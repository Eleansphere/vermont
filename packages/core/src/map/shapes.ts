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
    for (let column = 0; column < width; column++) {
      hexes.push(rectangleHex(column, row));
    }
  }
  return hexes;
}

/** The hex in the given column and row of a `rectangleHexes` map, both counted from 0. */
export function rectangleHex(column: number, row: number): Hex {
  return { q: column - Math.floor(row / 2), r: row };
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
