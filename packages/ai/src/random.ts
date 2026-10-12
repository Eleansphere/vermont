import type {
  BattleDefs,
  BattleState,
  Command,
  Draw,
  Hex,
  PlayerSlot,
  RngState,
} from '@vermont/core';
import {
  attackTargets,
  deploymentHexes,
  fieldedUnits,
  isFighting,
  nextRandomInt,
  opponentOf,
  pathFromReach,
  reserveUnits,
  unitReach,
  unitTypeOf,
} from '@vermont/core';
import { nearestTo } from './plan';
import { travelCost } from './routes';

function pick<T>(rng: RngState, choices: readonly T[]): Draw<T> {
  const draw = nextRandomInt(rng, 0, choices.length - 1);
  return { value: choices[draw.value]!, rng: draw.rng };
}

/** Puts the next waiting unit on any free hex of the zone. */
export function randomDeployment(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot,
  rng: RngState
): Draw<Command> {
  const [unit] = reserveUnits(state, player);
  const free = unit ? deploymentHexes(state, defs, unit) : [];
  if (!unit || free.length === 0) return { value: { type: 'EndDeployment' }, rng };

  const hex = pick(rng, free);
  return { value: { type: 'DeployUnit', unitId: unit.id, hex: hex.value }, rng: hex.rng };
}

/**
 * Orders without a thought behind them, only a direction: a unit attacks somebody it can
 * reach, whoever it is, and otherwise moves some way towards the nearest enemy it sees, or
 * towards the enemy camp.
 */
export function randomOrders(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot,
  rng: RngState
): Draw<Command> {
  const enemies = fieldedUnits(state, opponentOf(player));
  const camp = defs.camps[opponentOf(player)];

  for (const unit of fieldedUnits(state, player).filter(isFighting)) {
    const targets = unit.hasAttacked ? [] : attackTargets(state, defs, unit);
    if (targets.length > 0) {
      const target = pick(rng, targets);
      return {
        value: { type: 'Attack', unitId: unit.id, targetId: target.value.id },
        rng: target.rng,
      };
    }
    const type = unitTypeOf(defs, unit);
    // One march a turn: a unit that has moved or struck stays where it is.
    if (unit.hasAttacked || unit.movementLeft < type.movement) continue;

    const goal = nearestTo(enemies, unit.pos)?.pos ?? camp;
    if (!goal) continue;

    const cost = (from: Hex) => travelCost(defs, type.archetype, goal, from);
    const reach = unitReach(state, defs, unit);
    const closer = [...reach.values()].filter(
      (node) => node.canStop && cost(node.hex) < cost(unit.pos)
    );
    if (closer.length === 0) continue;

    const stop = pick(rng, closer);
    return {
      value: {
        type: 'MoveUnit',
        unitId: unit.id,
        path: pathFromReach(reach, stop.value.hex)!.hexes,
      },
      rng: stop.rng,
    };
  }
  return { value: { type: 'EndTurn' }, rng };
}
