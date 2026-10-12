import type { Hex } from '../hex/hex';
import { hexDistance, hexKey } from '../hex/hex';
import type { ReachNode } from '../movement/movement';
import { pathFromReach, reachableHexes } from '../movement/movement';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import type { GameEvent } from './command';
import type { BattleDefs } from './rules';
import type { FieldedUnit, Unit } from './unit';
import { fieldedUnits, unitTypeOf } from './unit';
import { moveContextFor } from './unitMovement';

/** What breaking, rallying or leaving the field did to one unit. */
export interface UnitChange {
  readonly unit: Unit;
  readonly events: readonly GameEvent[];
}

/**
 * A unit whose morale broke runs at once, as far from the enemy as its movement allows. It
 * takes no orders until it rallies.
 */
export function retreat(state: BattleState, defs: BattleDefs, unit: FieldedUnit): UnitChange {
  const enemies = fieldedUnits(state, opponentOf(unit.owner));
  const context = moveContextFor(state, defs, unit);
  const reach = reachableHexes(defs.map, unit.pos, unitTypeOf(defs, unit).movement, context);
  const distanceToEnemy = (from: Hex) =>
    Math.min(...enemies.map((enemy) => hexDistance(from, enemy.pos)));

  let refuge = reach.get(hexKey(unit.pos))!;
  for (const node of reach.values()) {
    if (node.canStop && isBetterRefuge(node, refuge, distanceToEnemy)) refuge = node;
  }
  return {
    unit: { ...unit, pos: refuge.hex, movementLeft: 0 },
    events: [
      { type: 'UnitRetreated', unitId: unit.id, path: pathFromReach(reach, refuge.hex)!.hexes },
    ],
  };
}

/** Further from the enemy wins, then the shorter run; the coordinates only break ties. */
function isBetterRefuge(
  candidate: ReachNode,
  best: ReachNode,
  distanceToEnemy: (from: Hex) => number
): boolean {
  const byDistance = distanceToEnemy(candidate.hex) - distanceToEnemy(best.hex);
  if (byDistance !== 0) return byDistance > 0;
  if (candidate.cost !== best.cost) return candidate.cost < best.cost;
  if (candidate.hex.q !== best.hex.q) return candidate.hex.q < best.hex.q;
  return candidate.hex.r < best.hex.r;
}
