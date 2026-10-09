import { describe, expect, it } from 'vitest';
import { Group } from 'three';
import type { BattleDefs, BattleState, FieldedUnit, GameEvent } from '@vermont/core';
import { dispatch, fieldedUnits, hexEquals, pathFromReach, unitReach } from '@vermont/core';
import { eventSteps } from './eventSteps';
import { createTerrainLayer } from './terrain';
import { deployedTrebia } from './testSupport';
import { Timeline } from './timeline';
import { UnitLayer } from './units';

function setUp(): {
  state: BattleState;
  defs: BattleDefs;
  units: UnitLayer;
  effects: Group;
  timeline: Timeline;
  play(events: readonly GameEvent[], after: BattleState): void;
} {
  const { state, defs } = deployedTrebia();
  const units = new UnitLayer(defs, createTerrainLayer(defs).surfaceHeight);
  units.sync(state);
  const effects = new Group();
  const timeline = new Timeline();
  const play = (events: readonly GameEvent[], after: BattleState) =>
    timeline.enqueue(
      ...events.flatMap((event) => eventSteps(event, { units, state: after, effects }))
    );
  return { state, defs, units, effects, timeline, play };
}

/** A unit of the active player and the furthest hex it can walk to. */
function longestWalk(state: BattleState, defs: BattleDefs) {
  for (const unit of fieldedUnits(state, state.activePlayer)) {
    const reach = unitReach(state, defs, unit);
    const far = [...reach.values()]
      .filter((node) => node.canStop)
      .sort((a, b) => b.cost - a.cost)[0];
    const path = far && pathFromReach(reach, far.hex);
    if (path && path.hexes.length > 2) return { unit, path: path.hexes };
  }
  throw new Error('No unit can walk two hexes');
}

describe('unit layer', () => {
  it('draws every unit on the field where the state has it', () => {
    const { state, units } = setUp();

    const fielded = fieldedUnits(state);
    expect(units.object.children).toHaveLength(fielded.length);
    for (const unit of fielded) {
      const view = units.view(unit.id)!;
      expect(hexEquals(view.hex, unit.pos)).toBe(true);
      expect(view.object.position.distanceTo(units.standPoint(unit.pos))).toBe(0);
      expect(units.viewAt(unit.pos)).toBe(view);
    }
  });

  it('drops units that left the field when synced', () => {
    const { state, units } = setUp();
    const gone = fieldedUnits(state)[0]!;

    units.sync({
      ...state,
      units: { ...state.units, [gone.id]: { ...gone, status: 'dead', pos: null } },
    });

    expect(units.view(gone.id)).toBeUndefined();
    expect(units.object.children).toHaveLength(fieldedUnits(state).length - 1);
  });
});

describe('event animations', () => {
  it('walks a unit along the path of its move', () => {
    const { state, defs, units, timeline, play } = setUp();
    const { unit, path } = longestWalk(state, defs);
    const result = dispatch(state, { type: 'MoveUnit', unitId: unit.id, path }, defs);
    if (!result.ok) throw new Error(result.rejection.message);
    const view = units.view(unit.id)!;
    const start = view.object.position.clone();

    play(result.events, result.state);
    timeline.update(0.08);

    // Half-way through the first step the unit is between the first two hexes.
    const firstStop = units.standPoint(path[1]!);
    expect(view.object.position.distanceTo(start)).toBeGreaterThan(0);
    expect(view.object.position.distanceTo(firstStop)).toBeGreaterThan(0);
    expect(hexEquals(view.hex, path[0]!)).toBe(true);

    timeline.finish();

    const goal = path.at(-1)!;
    expect(hexEquals(view.hex, goal)).toBe(true);
    expect(view.object.position.distanceTo(units.standPoint(goal))).toBeCloseTo(0);
  });

  it('shows an attack and removes the unit that died', () => {
    const { state, units, effects, timeline, play } = setUp();
    const attacker = fieldedUnits(state, 0)[0]!;
    const target = fieldedUnits(state, 1)[0]!;
    const home = units.view(attacker.id)!.object.position.clone();

    play(
      [
        {
          type: 'AttackResolved',
          attackerId: attacker.id,
          targetId: target.id,
          kind: 'melee',
          damage: target.hp,
          counterDamage: null,
        },
        { type: 'UnitDamaged', unitId: target.id, damage: target.hp, hp: 0 },
        { type: 'UnitDied', unitId: target.id, hex: target.pos },
      ],
      state
    );
    timeline.update(0.14);

    // In the middle of the strike the attacker leans towards its target.
    const leaning = units.view(attacker.id)!.object.position;
    expect(leaning.distanceTo(home)).toBeGreaterThan(0.1);
    expect(leaning.distanceTo(units.standPoint(target.pos))).toBeLessThan(
      home.distanceTo(units.standPoint(target.pos))
    );

    timeline.finish();

    expect(units.view(attacker.id)!.object.position.distanceTo(home)).toBeCloseTo(0);
    expect(units.view(target.id)).toBeUndefined();
    expect(effects.children).toHaveLength(0);
  });

  it('flies a missile for a ranged attack and cleans it up', () => {
    const { state, units, effects, timeline, play } = setUp();
    const shooter = fieldedUnits(state, 0)[0]!;
    const target = fieldedUnits(state, 1)[0]!;

    play(
      [
        {
          type: 'AttackResolved',
          attackerId: shooter.id,
          targetId: target.id,
          kind: 'ranged',
          damage: 1,
          counterDamage: null,
        },
      ],
      state
    );
    timeline.update(0.1);
    expect(effects.children).toHaveLength(1);
    expect(units.view(shooter.id)!.object.position.distanceTo(units.standPoint(shooter.pos))).toBe(
      0
    );

    timeline.finish();
    expect(effects.children).toHaveLength(0);
  });

  it('swaps two units and puts a deployed one on its hex', () => {
    const { state, units, timeline, play } = setUp();
    const [first, second] = fieldedUnits(state, 0) as [FieldedUnit, FieldedUnit];
    units.remove(second.id);

    play(
      [
        { type: 'UnitDeployed', unitId: second.id, hex: second.pos, from: null },
        { type: 'UnitsSwapped', unitId: first.id, targetId: second.id },
      ],
      state
    );
    timeline.finish();

    expect(hexEquals(units.view(first.id)!.hex, second.pos)).toBe(true);
    expect(hexEquals(units.view(second.id)!.hex, first.pos)).toBe(true);
    expect(units.view(second.id)!.object.scale.x).toBe(1);
  });

  it('ignores events about units it does not show', () => {
    const { state, timeline, play } = setUp();

    play(
      [
        {
          type: 'UnitMoved',
          unitId: 'nobody',
          path: [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
          ],
          cost: 1,
        },
        { type: 'UnitDamaged', unitId: 'nobody', damage: 1, hp: 1 },
        { type: 'UnitFled', unitId: 'nobody', hex: { q: 0, r: 0 } },
        { type: 'TurnStarted', player: 1, turn: 1 },
      ],
      state
    );

    expect(() => timeline.finish()).not.toThrow();
  });
});
