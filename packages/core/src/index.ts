/** Version of the rules; saved games record it so old saves can be recognised. */
export const RULES_VERSION = 1;

export type { Archetype } from './archetype';

export {
  HEX_DIRECTIONS,
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
} from './hex/hex';
export type { Hex, HexDirection, HexKey, LineSide } from './hex/hex';

export { createMap, hasHex, mapHexes, paintTerrain, terrainAt } from './map/battleMap';
export type { BattleMapDef, MapHex } from './map/battleMap';
export { hexagonHexes, rectangleHexes } from './map/shapes';
export { terrainMoveCost } from './map/terrain';
export type { TerrainDef, TerrainId, TerrainTable } from './map/terrain';
export { TERRAINS } from './data/terrains';

export { findPath, pathFromReach, reachableHexes, zoneOfControl } from './movement/movement';
export type { MoveContext, Path, Reach, ReachNode } from './movement/movement';

export { HILL_RANGE_BONUS, canSee, hasLineOfSight, rangeFrom, visibleHexes } from './sight/sight';
export type { SightContext } from './sight/sight';
