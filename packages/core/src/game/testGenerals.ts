import type { Hex } from '../hex/hex';
import { hexDistance } from '../hex/hex';
import { pathFromReach } from '../movement/movement';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import { attackTargets } from './combat';
import type { Command, GameEvent } from './command';
import { dispatch } from './dispatch';
import type { TestBattle } from './testSupport';
import type { FieldedUnit } from './unit';
import { fieldedUnits, isFighting, unitTypeOf } from './unit';
import { unitReach } from './unitMovement';

const MAX_COMMANDS = 2000;
const SHOOTING_DISTANCE = 2;

function distanceToEnemy(state: BattleState, unit: FieldedUnit, from: Hex): number {
  const enemies = fieldedUnits(state, opponentOf(unit.owner));
  return Math.min(...enemies.map((enemy) => hexDistance(from, enemy.pos)));
}

/** A simple-minded general: attack whoever is weakest in reach, otherwise close in. */
export function ordersFor(battle: TestBattle, unitId: string): Command | null {
  const unit = battle.state.units[unitId];
  if (!unit || !isFighting(unit)) return null;

  if (!unit.hasAttacked) {
    const [weakest] = attackTargets(battle.state, battle.defs, unit).sort((a, b) => a.hp - b.hp);
    if (weakest) return { type: 'Attack', unitId, targetId: weakest.id };
  }
  // Shooters keep their distance, everybody else closes in.
  const wanted = unitTypeOf(battle.defs, unit).range === undefined ? 1 : SHOOTING_DISTANCE;
  const offBy = (from: Hex) => Math.abs(distanceToEnemy(battle.state, unit, from) - wanted);
  const reach = unitReach(battle.state, battle.defs, unit);
  let goal = unit.pos;
  for (const node of reach.values()) {
    if (node.canStop && offBy(node.hex) < offBy(goal)) goal = node.hex;
  }
  if (hexDistance(goal, unit.pos) === 0) return null;
  return { type: 'MoveUnit', unitId, path: pathFromReach(reach, goal)!.hexes };
}

export interface PlayedBattle {
  readonly state: BattleState;
  readonly commands: readonly Command[];
  readonly events: readonly GameEvent[];
}

/** Both generals play until the battle is decided. Every command has to be accepted. */
export function fight(start: TestBattle): PlayedBattle {
  let state = start.state;
  const commands: Command[] = [];
  const events: GameEvent[] = [];
  const order = (command: Command) => {
    const result = dispatch(state, command, start.defs);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.rejection.message}`);
    state = result.state;
    commands.push(command);
    events.push(...result.events);
  };

  while (state.phase === 'battle' && commands.length < MAX_COMMANDS) {
    for (const { id } of fieldedUnits(state, state.activePlayer)) {
      // A unit may move and then attack, or attack and ride away.
      for (let step = 0; step < 3 && state.phase === 'battle'; step++) {
        const command = ordersFor({ state, defs: start.defs }, id);
        if (!command) break;
        order(command);
      }
    }
    if (state.phase === 'battle') order({ type: 'EndTurn' });
  }
  return { state, commands, events };
}
