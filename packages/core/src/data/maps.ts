import type { BattleMapDef } from '../map/battleMap';
import { createMap, paintTerrain } from '../map/battleMap';
import { rectangleHex, rectangleHexes } from '../map/shapes';
import type { TerrainId } from '../map/terrain';
import type { MapTable } from '../scenario/scenario';

/** A hex of a rectangular map as `[column, row]`, both counted from 0. */
type Cell = readonly [column: number, row: number];

type Features = readonly (readonly [TerrainId, readonly Cell[]])[];

export const TREBIA_WIDTH = 14;
export const TREBIA_HEIGHT = 12;

/**
 * A river comes in from the west and ends in a marsh in the middle of the field. It can be
 * crossed at two fords or ridden around on the open eastern side. Each army has a hill in
 * front of its lines and a wood on one wing.
 */
const TREBIA_FEATURES: Features = [
  // prettier-ignore
  ['river', [[0, 5], [1, 5], [3, 5], [4, 5], [5, 6], [7, 6], [8, 6]]],
  // prettier-ignore
  ['ford', [[2, 5], [6, 6]]],
  // prettier-ignore
  ['marsh', [[9, 6], [10, 6]]],
  // prettier-ignore
  ['hill', [[4, 3], [5, 3], [9, 8], [10, 8]]],
  // prettier-ignore
  ['forest', [[11, 3], [12, 3], [12, 4], [1, 7], [1, 8], [2, 8]]],
];

/** A rectangular plain with the given features painted on it. */
function rectangleMap(id: string, width: number, height: number, features: Features): BattleMapDef {
  let map = createMap(id, rectangleHexes(width, height));
  for (const [terrain, cells] of features) {
    map = paintTerrain(
      map,
      terrain,
      cells.map(([column, row]) => rectangleHex(column, row))
    );
  }
  return map;
}

export const MAPS: MapTable = {
  trebia: rectangleMap('trebia', TREBIA_WIDTH, TREBIA_HEIGHT, TREBIA_FEATURES),
};
