import type { BattleMapDef } from './battleMap';
import { createMap, paintTerrain } from './battleMap';
import { rectangleHex, rectangleHexes } from './shapes';
import type { TerrainId } from './terrain';

/**
 * The symbol each terrain is drawn with in a map grid. A camp has none: camps belong to the
 * scenario and are painted on the map when a battle starts.
 */
export const TERRAIN_SYMBOLS = {
  '.': 'plain',
  f: 'forest',
  h: 'hill',
  M: 'mountain',
  m: 'marsh',
  '=': 'ford',
  B: 'bridge',
  '#': 'road',
  '~': 'river',
  s: 'sea',
} as const satisfies Readonly<Record<string, TerrainId>>;

/**
 * A rectangular map drawn as text: one string for each row of hexes from the top, one symbol
 * of `TERRAIN_SYMBOLS` for each hex from the left. Spaces mean nothing, so odd rows can be
 * indented the way they are shifted on the map.
 */
export type MapGrid = readonly string[];

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

/** Symbols of the rows without the spaces between them. */
function gridRows(id: string, grid: MapGrid): string[][] {
  const rows = grid.map((row) => [...row.replace(/\s/g, '')]);
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error(`Map "${id}" has no hexes`);
  rows.forEach((row, index) => {
    if (row.length !== width) {
      throw new Error(`Row ${index} of map "${id}" has ${row.length} hexes, expected ${width}`);
    }
  });
  return rows;
}

/** How many hexes wide and how many rows tall the drawn map is. */
export function gridSize(id: string, grid: MapGrid): GridSize {
  const rows = gridRows(id, grid);
  return { width: rows[0]!.length, height: rows.length };
}

/** Builds the map drawn by the grid; hex (column, row) of it is `rectangleHex(column, row)`. */
export function mapFromGrid(id: string, grid: MapGrid): BattleMapDef {
  const rows = gridRows(id, grid);
  let map = createMap(id, rectangleHexes(rows[0]!.length, rows.length));
  rows.forEach((symbols, row) => {
    symbols.forEach((symbol, column) => {
      if (!Object.hasOwn(TERRAIN_SYMBOLS, symbol)) {
        throw new Error(`Unknown terrain "${symbol}" in row ${row} of map "${id}"`);
      }
      const terrain = TERRAIN_SYMBOLS[symbol as keyof typeof TERRAIN_SYMBOLS];
      map = paintTerrain(map, terrain, [rectangleHex(column, row)]);
    });
  });
  return map;
}
