import type { Hex } from '../../hex/hex';
import { hexDistance, hexKey } from '../../hex/hex';
import type { ReachNode } from '../../movement/movement';
import { pathFromReach, reachableHexes } from '../../movement/movement';
import type { BattleState } from '../battleState';
import { opponentOf } from '../battleState';
import type { CommandHandler, EndTurnCommand, GameEvent } from '../command';
import { moraleChanged, shiftMorale } from '../morale';
import type { BattleDefs } from '../rules';
import type { FieldedUnit, Unit } from '../unit';
import { adjacentUnits, fieldedUnits, isFighting, unitTypeOf, withUnits } from '../unit';
import { moveContextFor } from '../unitMovement';

/** The player who moves first in a round; when the move returns to them, a new round starts. */
const ROUND_OPENER = 0;

/** What the start of a turn did to one unit. */
interface Refresh {
  readonly unit: Unit;
  readonly events: readonly GameEvent[];
}

export const endTurn: CommandHandler<EndTurnCommand> = {
  phases: ['battle'],

  apply(state, _command, defs) {
    const nextPlayer = opponentOf(state.activePlayer);
    const nextTurn = nextPlayer === ROUND_OPENER ? state.turn + 1 : state.turn;

    let next: BattleState = { ...state, activePlayer: nextPlayer, turn: nextTurn };
    const events: GameEvent[] = [
      { type: 'TurnEnded', player: state.activePlayer, turn: state.turn },
    ];
    // One unit after another: where a routing unit runs to depends on those that ran before it.
    for (const { id } of fieldedUnits(next, nextPlayer)) {
      const refresh = startTurnOf(next, defs, next.units[id] as FieldedUnit);
      next = withUnits(next, [refresh.unit]);
      events.push(...refresh.events);
    }
    events.push({ type: 'TurnStarted', player: nextPlayer, turn: nextTurn });
    return { state: next, events };
  },
};

function startTurnOf(state: BattleState, defs: BattleDefs, unit: FieldedUnit): Refresh {
  if (unit.moraleState !== 'routing') return recover(state, defs, unit);
  if (!unit.hasRetreated) return retreat(state, defs, unit);
  return isPursued(state, unit) ? flee(unit) : rally(defs, unit);
}

/** A unit that fights gets its movement and attack back, and some morale if left in peace. */
function recover(state: BattleState, defs: BattleDefs, unit: FieldedUnit): Refresh {
  const type = unitTypeOf(defs, unit);
  const rested = isPursued(state, unit)
    ? unit
    : shiftMorale(unit, defs.rules.morale.recoveryPerTurn, defs.rules.morale, type.morale);
  return {
    unit: { ...rested, movementLeft: type.movement, hasAttacked: false },
    events: rested === unit ? [] : [moraleChanged(rested)],
  };
}

/** A routing unit runs as far from the enemy as its movement allows. */
function retreat(state: BattleState, defs: BattleDefs, unit: FieldedUnit): Refresh {
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
    unit: { ...unit, pos: refuge.hex, hasRetreated: true, movementLeft: 0, hasAttacked: false },
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

/** A routing unit that got away from the enemy fights on, shaken. */
function rally(defs: BattleDefs, unit: FieldedUnit): Refresh {
  const rules = defs.rules.morale;
  const steadied = shiftMorale(unit, rules.routingAt + 1 - unit.morale, rules);
  const rallied = {
    ...steadied,
    hasRetreated: false,
    movementLeft: unitTypeOf(defs, unit).movement,
    hasAttacked: false,
  };
  return {
    unit: rallied,
    events: [{ type: 'UnitRallied', unitId: unit.id }, moraleChanged(rallied)],
  };
}

/** A routing unit the enemy caught up with leaves the battlefield for good. */
function flee(unit: FieldedUnit): Refresh {
  return {
    unit: { ...unit, status: 'fled', pos: null, movementLeft: 0 },
    events: [{ type: 'UnitFled', unitId: unit.id, hex: unit.pos }],
  };
}

/** Whether an enemy that still fights stands next to the unit. */
function isPursued(state: BattleState, unit: FieldedUnit): boolean {
  return adjacentUnits(state, unit.pos, opponentOf(unit.owner)).some(isFighting);
}
