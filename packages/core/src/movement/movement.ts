import type { Archetype } from '../archetype';
import type { Hex, HexKey } from '../hex/hex';
import { hexDistance, hexEquals, hexKey, hexNeighbors } from '../hex/hex';
import type { BattleMapDef } from '../map/battleMap';
import { hasHex, terrainAt } from '../map/battleMap';
import type { TerrainTable } from '../map/terrain';
import { terrainMoveCost } from '../map/terrain';
import { MinHeap } from './minHeap';

/** Everything besides the map that decides where a unit can go. */
export interface MoveContext {
  readonly terrains: TerrainTable;
  readonly archetype: Archetype;
  /** Hexes held by the mover's own side: they can be crossed but not stopped on. */
  readonly friendly?: ReadonlySet<HexKey>;
  /** Hexes held by the enemy: they cannot be entered. */
  readonly enemy?: ReadonlySet<HexKey>;
  /** Hexes where a unit must stop as soon as it enters; see `zoneOfControl`. */
  readonly zoneOfControl?: ReadonlySet<HexKey>;
}

export interface ReachNode {
  readonly hex: Hex;
  /** Movement points spent to get here by the cheapest route. */
  readonly cost: number;
  /** Previous hex on the cheapest route; `null` for the starting hex. */
  readonly from: Hex | null;
  /** False for hexes the unit can only pass through. */
  readonly canStop: boolean;
}

/** Hexes a unit can get to, keyed by hex. Includes the starting hex. */
export type Reach = ReadonlyMap<HexKey, ReachNode>;

export interface Path {
  /** Hexes from the start to the goal, both included. */
  readonly hexes: Hex[];
  readonly cost: number;
}

/** Hexes next to an enemy unit; a unit that enters one has to stop there. */
export function zoneOfControl(map: BattleMapDef, enemyHexes: Iterable<Hex>): Set<HexKey> {
  const zone = new Set<HexKey>();
  for (const enemyHex of enemyHexes) {
    for (const neighbor of hexNeighbors(enemyHex)) {
      if (hasHex(map, neighbor)) zone.add(hexKey(neighbor));
    }
  }
  return zone;
}

/** Every hex the unit can get to with `movePoints`, with the cost and route to each. */
export function reachableHexes(
  map: BattleMapDef,
  start: Hex,
  movePoints: number,
  context: MoveContext
): Reach {
  return search(map, start, context, movePoints);
}

/** Route to a hex found by `reachableHexes`, or `null` if the unit cannot stop there. */
export function pathFromReach(reach: Reach, goal: Hex): Path | null {
  const goalNode = reach.get(hexKey(goal));
  if (!goalNode?.canStop) return null;

  const hexes: Hex[] = [];
  for (let node: ReachNode | undefined = goalNode; node;) {
    hexes.push(node.hex);
    node = node.from ? reach.get(hexKey(node.from)) : undefined;
  }
  return { hexes: hexes.reverse(), cost: goalNode.cost };
}

/**
 * Cheapest route from `start` to `goal` (A*), or `null` when there is none. The cost is not
 * limited by the unit's movement points unless `maxCost` is given.
 */
export function findPath(
  map: BattleMapDef,
  start: Hex,
  goal: Hex,
  context: MoveContext,
  maxCost = Infinity
): Path | null {
  if (!hasHex(map, start) || !hasHex(map, goal)) return null;
  return pathFromReach(search(map, start, context, maxCost, goal), goal);
}

/**
 * Cheapest-first search outwards from `start`. With a goal it is steered towards it and stops
 * once the goal is reached, so the result then holds only the hexes visited on the way.
 */
function search(
  map: BattleMapDef,
  start: Hex,
  context: MoveContext,
  budget: number,
  goal?: Hex
): Map<HexKey, ReachNode> {
  const settled = new Map<HexKey, ReachNode>();
  if (!hasHex(map, start)) return settled;

  const startKey = hexKey(start);
  const cheapestStep = goal ? cheapestMoveCost(context) : 0;
  const estimateToGoal = (from: Hex) => (goal ? hexDistance(from, goal) * cheapestStep : 0);

  const bestCost = new Map<HexKey, number>([[startKey, 0]]);
  const open = new MinHeap<ReachNode>();
  open.push({ hex: start, cost: 0, from: null, canStop: true }, estimateToGoal(start));

  for (let node = open.pop(); node; node = open.pop()) {
    const key = hexKey(node.hex);
    if (settled.has(key)) continue;
    settled.set(key, node);

    if (goal && hexEquals(node.hex, goal)) break;
    // A unit that walked into a zone of control stays there; one that starts in it may leave.
    if (key !== startKey && context.zoneOfControl?.has(key)) continue;

    for (const neighbor of hexNeighbors(node.hex)) {
      const stepCost = entryCost(map, neighbor, context);
      if (stepCost === null) continue;

      const cost = node.cost + stepCost;
      const neighborKey = hexKey(neighbor);
      if (cost > budget || cost >= (bestCost.get(neighborKey) ?? Infinity)) continue;

      bestCost.set(neighborKey, cost);
      const canStop = !context.friendly?.has(neighborKey);
      open.push({ hex: neighbor, cost, from: node.hex, canStop }, cost + estimateToGoal(neighbor));
    }
  }
  return settled;
}

/** Movement points to step onto the hex, or `null` if the unit cannot enter it. */
function entryCost(map: BattleMapDef, target: Hex, context: MoveContext): number | null {
  const terrain = terrainAt(map, context.terrains, target);
  if (!terrain) return null;

  const key = hexKey(target);
  if (context.enemy?.has(key)) return null;
  // The unit would have to stop here, and it cannot stop on its own side's unit.
  if (context.friendly?.has(key) && context.zoneOfControl?.has(key)) return null;

  return terrainMoveCost(terrain, context.archetype);
}

/**
 * Lowest cost of a single step for the archetype. Multiplied by distance it never overestimates
 * the remaining cost, which A* needs to return the cheapest route.
 */
function cheapestMoveCost(context: MoveContext): number {
  const costs = Object.values(context.terrains)
    .map((terrain) => terrainMoveCost(terrain, context.archetype))
    .filter((cost) => cost !== null);
  return Math.max(0, Math.min(...costs));
}
