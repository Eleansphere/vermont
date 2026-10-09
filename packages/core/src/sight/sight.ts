import type { Hex, HexKey } from '../hex/hex';
import { hexDistance, hexKey, hexLine, hexSpiral } from '../hex/hex';
import type { BattleMapDef } from '../map/battleMap';
import { hasHex, terrainAt } from '../map/battleMap';
import type { TerrainTable } from '../map/terrain';

/** How much further a unit on a hill sees and shoots. */
export const HILL_RANGE_BONUS = 1;

export interface SightContext {
  readonly terrains: TerrainTable;
  /** Hexes with units on them; a unit hides what is behind it from observers on low ground. */
  readonly units?: ReadonlySet<HexKey>;
}

/** Sight or shooting range of a unit standing on `from`, including the bonus for a hill. */
export function rangeFrom(
  map: BattleMapDef,
  from: Hex,
  baseRange: number,
  terrains: TerrainTable
): number {
  const onHill = terrainAt(map, terrains, from)?.isHill ?? false;
  return onHill ? baseRange + HILL_RANGE_BONUS : baseRange;
}

/**
 * Whether an observer on `from` has an unobstructed view of `to`. Only hexes strictly between
 * the two can block: a forest is visible itself, what lies behind it is not. Distance is not
 * checked here.
 */
export function hasLineOfSight(
  map: BattleMapDef,
  from: Hex,
  to: Hex,
  context: SightContext
): boolean {
  if (!hasHex(map, from) || !hasHex(map, to)) return false;

  const fromHill = terrainAt(map, context.terrains, from)?.isHill ?? false;
  const blocks = (target: Hex) => blocksSight(map, target, fromHill, context);

  // Where the line runs exactly along an edge the two lines take different hexes, and the view
  // is blocked only if both of them block.
  const oneSide = hexLine(from, to, 1);
  const otherSide = hexLine(from, to, -1);
  for (let step = 1; step < oneSide.length - 1; step++) {
    if (blocks(oneSide[step]!) && blocks(otherSide[step]!)) return false;
  }
  return true;
}

/** Hexes of the map that a unit on `from` with the given sight range can see, itself included. */
export function visibleHexes(
  map: BattleMapDef,
  from: Hex,
  sight: number,
  context: SightContext
): Hex[] {
  if (!hasHex(map, from)) return [];
  const range = rangeFrom(map, from, sight, context.terrains);
  return hexSpiral(from, range).filter((target) => hasLineOfSight(map, from, target, context));
}

/** Whether `to` is within `range` of `from` (hill bonus included) and in view. */
export function canSee(
  map: BattleMapDef,
  from: Hex,
  to: Hex,
  range: number,
  context: SightContext
): boolean {
  return (
    hexDistance(from, to) <= rangeFrom(map, from, range, context.terrains) &&
    hasLineOfSight(map, from, to, context)
  );
}

function blocksSight(
  map: BattleMapDef,
  target: Hex,
  fromHill: boolean,
  context: SightContext
): boolean {
  const terrain = terrainAt(map, context.terrains, target);
  if (!terrain) return false;
  if (fromHill) return terrain.blocksSightFromHill;
  return terrain.blocksSight || (context.units?.has(hexKey(target)) ?? false);
}
