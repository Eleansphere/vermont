import type { Hex } from '../hex/hex';
import { hexDistance, hexKey } from '../hex/hex';
import { terrainAt } from '../map/battleMap';
import { terrainMoveCost } from '../map/terrain';
import type { MoveContext, Reach } from '../movement/movement';
import { reachableHexes, zoneOfControl } from '../movement/movement';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import type { Rejection } from './command';
import type { BattleDefs } from './rules';
import type { FieldedUnit } from './unit';
import { fieldedUnits, isFighting, unitHexes, unitTypeOf } from './unit';

/** A checked route: what it costs and whether the unit has to stay where it ends. */
export interface Walk {
  readonly cost: number;
  /** The route ends next to an enemy, which uses up the rest of the unit's movement. */
  readonly endsInZoneOfControl: boolean;
}

/**
 * What stands in the unit's way: its own side can be passed through, the enemy cannot, and
 * enemies that still fight stop it on the hexes around them.
 */
export function moveContextFor(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit
): MoveContext {
  const friends = fieldedUnits(state, unit.owner).filter((friend) => friend.id !== unit.id);
  const enemies = fieldedUnits(state, opponentOf(unit.owner));
  return {
    terrains: defs.terrains,
    archetype: unitTypeOf(defs, unit).archetype,
    friendly: unitHexes(friends),
    enemy: unitHexes(enemies),
    zoneOfControl: zoneOfControl(
      defs.map,
      enemies.filter(isFighting).map((enemy) => enemy.pos)
    ),
  };
}

/** Hexes the unit can still move to this turn, with the route to each. */
export function unitReach(state: BattleState, defs: BattleDefs, unit: FieldedUnit): Reach {
  return reachableHexes(defs.map, unit.pos, unit.movementLeft, moveContextFor(state, defs, unit));
}

/** Checks a route hex by hex against the movement rules. */
export function checkWalk(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit,
  path: readonly Hex[]
): Walk | Rejection {
  const [start, ...steps] = path;
  if (!start || steps.length === 0 || hexDistance(start, unit.pos) !== 0) {
    return invalidPath(`A path must start on the hex of unit "${unit.id}" and leave it`);
  }
  const context = moveContextFor(state, defs, unit);

  let cost = 0;
  let previous = start;
  for (const [index, step] of steps.entries()) {
    const key = hexKey(step);
    if (hexDistance(previous, step) !== 1) {
      return invalidPath(`Hex ${key} is not next to the previous hex of the path`);
    }
    // A unit that walked into a zone of control stays there; one that starts in it may leave.
    if (index > 0 && context.zoneOfControl?.has(hexKey(previous))) {
      return {
        code: 'zoneOfControl',
        message: `Unit "${unit.id}" has to stop on ${hexKey(previous)}, next to an enemy`,
      };
    }
    const terrain = terrainAt(defs.map, defs.terrains, step);
    if (!terrain) return invalidPath(`Hex ${key} is not on the map`);

    const stepCost = terrainMoveCost(terrain, context.archetype);
    if (stepCost === null) {
      return { code: 'impassable', message: `Unit "${unit.id}" cannot enter ${terrain.id}` };
    }
    const mustStop = context.zoneOfControl?.has(key) || index === steps.length - 1;
    if (context.enemy?.has(key) || (mustStop && context.friendly?.has(key))) {
      return { code: 'hexOccupied', message: `Hex ${key} is occupied` };
    }
    cost += stepCost;
    if (cost > unit.movementLeft) {
      return {
        code: 'notEnoughMovement',
        message: `Unit "${unit.id}" has ${unit.movementLeft} movement points, the path needs more`,
      };
    }
    previous = step;
  }
  return { cost, endsInZoneOfControl: context.zoneOfControl?.has(hexKey(previous)) ?? false };
}

/** How far along a route a unit really got. */
export interface March {
  /** Hexes walked through, from the starting hex to the one the unit stopped on. */
  readonly path: readonly Hex[];
  readonly cost: number;
  readonly endsInZoneOfControl: boolean;
  /** An enemy the route did not reckon with stopped the unit short of its end. */
  readonly ambushed: boolean;
}

/**
 * Walks a route that `checkWalk` passed for what the player knew, against what is really on
 * the field: the unit stops in front of an enemy standing in its way and on the first hex next
 * to one. A route checked against the real state is walked to its end. The unit never has to
 * stop on a hex of its own side: a unit standing there would have seen the enemy, and the
 * route would have been refused.
 */
export function marchAlong(
  state: BattleState,
  defs: BattleDefs,
  unit: FieldedUnit,
  path: readonly Hex[]
): March {
  const context = moveContextFor(state, defs, unit);
  const walked: { hex: Hex; cost: number }[] = [{ hex: unit.pos, cost: 0 }];
  for (const step of path.slice(1)) {
    const key = hexKey(step);
    if (context.enemy?.has(key)) break;
    const terrain = terrainAt(defs.map, defs.terrains, step);
    const stepCost = terrain && terrainMoveCost(terrain, context.archetype);
    if (stepCost === null || stepCost === undefined) break;
    walked.push({ hex: step, cost: walked.at(-1)!.cost + stepCost });
    if (context.zoneOfControl?.has(key)) break;
  }
  const last = walked.at(-1)!;
  return {
    path: walked.map((step) => step.hex),
    cost: last.cost,
    endsInZoneOfControl: context.zoneOfControl?.has(hexKey(last.hex)) ?? false,
    ambushed: walked.length < path.length,
  };
}

function invalidPath(message: string): Rejection {
  return { code: 'invalidPath', message };
}
