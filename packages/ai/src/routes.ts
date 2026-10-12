import type { Archetype, BattleDefs, BattleMapDef, Hex, Reach } from '@vermont/core';
import { hexKey, reachableHexes } from '@vermont/core';

/** Cost of a hex that cannot be reached at all; more than any real route. */
export const UNREACHABLE = 1000;

/**
 * Routes over the bare terrain never change during a battle, so each is worked out once per
 * map. The map object is the key: a battle keeps the same one from start to end.
 */
const routesByMap = new WeakMap<BattleMapDef, Map<string, Reach>>();

/**
 * Movement points a unit of the archetype needs between `goal` and `from` over the terrain
 * alone, as if no unit stood on the field. It tells which way round a river leads; a straight
 * distance does not.
 */
export function travelCost(defs: BattleDefs, archetype: Archetype, goal: Hex, from: Hex): number {
  let routes = routesByMap.get(defs.map);
  if (!routes) {
    routes = new Map();
    routesByMap.set(defs.map, routes);
  }
  const key = `${hexKey(goal)}|${archetype}`;
  let reach = routes.get(key);
  if (!reach) {
    reach = reachableHexes(defs.map, goal, Infinity, { terrains: defs.terrains, archetype });
    routes.set(key, reach);
  }
  return reach.get(hexKey(from))?.cost ?? UNREACHABLE;
}
