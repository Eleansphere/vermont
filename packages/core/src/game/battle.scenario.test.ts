import { describe, expect, it } from 'vitest';
import { RULES } from '../data/rules';
import type { Hex } from '../hex/hex';
import { hex, hexDistance } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { rectangleHexes } from '../map/shapes';
import { pathFromReach } from '../movement/movement';
import type { BattleState } from './battleState';
import { opponentOf } from './battleState';
import { attackTargets } from './combat';
import type { Command, GameEvent } from './command';
import { dispatch, dispatchAll } from './dispatch';
import { deserializeBattle, serializeBattle } from './serialize';
import type { TestBattle } from './testSupport';
import { battleWith } from './testSupport';
import type { FieldedUnit, UnitPlacement } from './unit';
import { fieldedUnits, isFighting, unitTypeOf } from './unit';
import { unitReach } from './unitMovement';

const MAX_COMMANDS = 2000;
const SHOOTING_DISTANCE = 2;

/** Rome at the top, Carthage at the bottom, a wood and a hill between them. */
function cannae(seed: number): TestBattle {
  const open = createMap('small-field', rectangleHexes(8, 8));
  const map = paintTerrain(paintTerrain(open, 'forest', [hex(0, 3), hex(-1, 4)]), 'hill', [
    hex(4, 3),
    hex(3, 4),
  ]);
  const army = (owner: 0 | 1, row: number, typeIds: string[]): UnitPlacement[] =>
    typeIds.map((typeId, column) => ({
      typeId,
      owner,
      pos: hex(column + 1 - Math.floor(row / 2), row),
    }));
  return battleWith(
    [
      ...army(0, 0, ['equites', 'triarii', 'principes', 'velites']),
      ...army(0, 1, ['hastati', 'hastati']),
      ...army(1, 7, ['numidian-cavalry', 'libyan-spearmen', 'war-elephants', 'balearic-slingers']),
      ...army(1, 6, ['gallic-mercenaries', 'iberian-cavalry']),
    ],
    { map, rules: RULES, seed, camps: { 0: hex(0, 0), 1: hex(-3, 7) } }
  );
}

function distanceToEnemy(state: BattleState, unit: FieldedUnit, from: Hex): number {
  const enemies = fieldedUnits(state, opponentOf(unit.owner));
  return Math.min(...enemies.map((enemy) => hexDistance(from, enemy.pos)));
}

/** A simple-minded general: attack whoever is weakest in reach, otherwise close in. */
function ordersFor(battle: TestBattle, unitId: string): Command | null {
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

interface PlayedBattle {
  readonly state: BattleState;
  readonly commands: readonly Command[];
  readonly events: readonly GameEvent[];
}

/** Both generals play until the battle is decided. Every command has to be accepted. */
function fight(start: TestBattle): PlayedBattle {
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

describe('scenario: a battle of two armies', () => {
  it('is fought until one side has no unit left on the field', () => {
    const battle = fight(cannae(218));
    const { winner } = battle.state;

    expect(battle.state.phase).toBe('ended');
    expect(winner?.reason).toBe('armyBroken');
    expect(fieldedUnits(battle.state, opponentOf(winner!.player))).toEqual([]);
    expect(fieldedUnits(battle.state, winner!.player).length).toBeGreaterThan(0);
    expect(battle.events.at(-1)).toMatchObject({ type: 'BattleEnded', winner: winner!.player });
  });

  it('uses every part of the rules on the way', () => {
    const seen = new Set<string>();
    for (const seed of [218, 204, 201]) {
      for (const event of fight(cannae(seed)).events) {
        seen.add(event.type === 'AttackResolved' ? `${event.type}:${event.kind}` : event.type);
      }
    }

    expect([...seen].sort()).toEqual([
      'AttackResolved:melee',
      'AttackResolved:ranged',
      'BattleEnded',
      'MoraleChanged',
      'TurnEnded',
      'TurnStarted',
      'UnitDamaged',
      'UnitDied',
      'UnitFled',
      'UnitMoved',
      'UnitRallied',
      'UnitRetreated',
    ]);
  });

  it('keeps every unit on its own hex and within its limits the whole time', () => {
    const start = cannae(216);
    let state = start.state;

    for (const command of fight(start).commands) {
      state = dispatch(state, command, start.defs).state;
      const fielded = fieldedUnits(state);
      const hexes = new Set(fielded.map((unit) => `${unit.pos.q},${unit.pos.r}`));

      expect(hexes.size).toBe(fielded.length);
      for (const unit of Object.values(state.units)) {
        expect(unit.hp).toBeGreaterThanOrEqual(0);
        expect(unit.morale).toBeGreaterThanOrEqual(0);
        expect(unit.morale).toBeLessThanOrEqual(RULES.morale.max);
        expect(unit.movementLeft).toBeGreaterThanOrEqual(0);
        expect(unit.status === 'dead').toBe(unit.hp === 0);
      }
    }
  });

  it('plays out the same way again from the same seed and commands', () => {
    const first = fight(cannae(202));
    const replay = dispatchAll(cannae(202).state, first.commands, cannae(202).defs);

    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(first.state);
    expect(replay.events).toEqual(first.events);
  });

  it('goes differently with a different seed', () => {
    expect(serializeBattle(fight(cannae(1)).state)).not.toBe(
      serializeBattle(fight(cannae(2)).state)
    );
  });

  it('survives a save and load in the middle of the fighting', () => {
    const start = cannae(218);
    const whole = fight(start);
    const half = Math.floor(whole.commands.length / 2);

    const firstHalf = dispatchAll(start.state, whole.commands.slice(0, half), start.defs);
    const loaded = deserializeBattle(serializeBattle(firstHalf.state));
    const resumed = dispatchAll(loaded, whole.commands.slice(half), start.defs);

    expect(loaded).toEqual(firstHalf.state);
    expect(resumed.state).toEqual(whole.state);
  });
});
