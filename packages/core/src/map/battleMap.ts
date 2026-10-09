import type { Hex, HexKey } from '../hex/hex';
import { hexKey, parseHexKey } from '../hex/hex';
import type { TerrainDef, TerrainId, TerrainTable } from './terrain';

export interface MapHex {
  readonly terrain: TerrainId;
}

/** A battlefield: the hexes that exist and their terrain. A hex missing here is off the map. */
export interface BattleMapDef {
  readonly id: string;
  readonly hexes: Readonly<Record<HexKey, MapHex>>;
}

const DEFAULT_TERRAIN: TerrainId = 'plain';

/** Builds a map from a list of hexes, all with the same terrain. */
export function createMap(
  id: string,
  hexes: readonly Hex[],
  terrain: TerrainId = DEFAULT_TERRAIN
): BattleMapDef {
  const mapHexes: Record<HexKey, MapHex> = {};
  for (const mapHex of hexes) {
    mapHexes[hexKey(mapHex)] = { terrain };
  }
  return { id, hexes: mapHexes };
}

/** Returns a copy of the map with the given hexes changed to `terrain`. */
export function paintTerrain(
  map: BattleMapDef,
  terrain: TerrainId,
  hexes: readonly Hex[]
): BattleMapDef {
  const painted: Record<HexKey, MapHex> = { ...map.hexes };
  for (const paintedHex of hexes) {
    const key = hexKey(paintedHex);
    if (!(key in painted)) {
      throw new Error(`Hex ${key} is not on map "${map.id}"`);
    }
    painted[key] = { terrain };
  }
  return { ...map, hexes: painted };
}

export function hasHex(map: BattleMapDef, target: Hex): boolean {
  return hexKey(target) in map.hexes;
}

export function mapHexes(map: BattleMapDef): Hex[] {
  return (Object.keys(map.hexes) as HexKey[]).map(parseHexKey);
}

/** Terrain of the hex, or `undefined` when the hex is off the map. */
export function terrainAt(
  map: BattleMapDef,
  terrains: TerrainTable,
  target: Hex
): TerrainDef | undefined {
  const mapHex = map.hexes[hexKey(target)];
  return mapHex && terrains[mapHex.terrain];
}
