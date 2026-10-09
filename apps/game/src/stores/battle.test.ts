import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { FieldedUnit, Hex } from '@vermont/core';
import { fieldedUnits, hexEquals, pathFromReach, unitReach } from '@vermont/core';
import { useBattleStore } from './battle';

const SEED = 7;

function startedStore() {
  const store = useBattleStore();
  store.start(SEED);
  return store;
}

/** A unit of the active player that can move, and a hex it can move to. */
function movableUnit(store: ReturnType<typeof useBattleStore>): { unit: FieldedUnit; goal: Hex } {
  for (const unit of fieldedUnits(store.state!, store.state!.activePlayer)) {
    const reach = unitReach(store.state!, store.defs!, unit);
    const goal = [...reach.values()].find((node) => node.canStop && node.cost > 0);
    if (goal) return { unit, goal: goal.hex };
  }
  throw new Error('No unit can move');
}

describe('battle store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('starts the scenario with both armies on the field', () => {
    const store = startedStore();

    expect(store.scenario?.id).toBe('trebia');
    expect(store.state?.phase).toBe('battle');
    expect(fieldedUnits(store.state!, 0)).toHaveLength(12);
    expect(fieldedUnits(store.state!, 1)).toHaveLength(12);
    expect(store.played).toBeNull();
  });

  it('selects a unit of the active player and marks where it can go', () => {
    const store = startedStore();
    const { unit, goal } = movableUnit(store);

    store.pick({ hex: unit.pos, unitId: unit.id });

    expect(store.selectedUnitId).toBe(unit.id);
    expect(store.highlights.selected).toEqual(unit.pos);
    expect(store.highlights.reach?.some((reachable) => hexEquals(reachable, goal))).toBe(true);
    expect(store.highlights.reach?.some((reachable) => hexEquals(reachable, unit.pos))).toBe(false);
  });

  it('does not select a unit of the other player', () => {
    const store = startedStore();
    const enemy = fieldedUnits(store.state!, 1)[0]!;

    store.pick({ hex: enemy.pos, unitId: enemy.id });

    expect(store.selectedUnitId).toBeNull();
  });

  it('shows the route to the hex under the pointer', () => {
    const store = startedStore();
    const { unit, goal } = movableUnit(store);
    store.pick({ hex: unit.pos, unitId: unit.id });

    store.hover(goal);

    const path = pathFromReach(unitReach(store.state!, store.defs!, unit), goal)!;
    expect(store.highlights.path).toEqual(path.hexes.slice(1));

    store.hover(null);
    expect(store.highlights.path).toEqual([]);
  });

  it('moves the selected unit to a clicked hex and hands the events to the renderer', () => {
    const store = startedStore();
    const { unit, goal } = movableUnit(store);
    store.pick({ hex: unit.pos, unitId: unit.id });

    store.pick({ hex: goal });

    expect(store.state!.units[unit.id]!.pos).toEqual(goal);
    expect(store.played?.events.map((event) => event.type)).toContain('UnitMoved');
    expect(store.played?.state).toBe(store.state);
    expect(store.selectedUnitId).toBe(unit.id);
    expect(store.highlights.selected).toEqual(goal);
  });

  it('drops the selection on a click it cannot act on', () => {
    const store = startedStore();
    const { unit } = movableUnit(store);
    const before = store.state;
    store.pick({ hex: unit.pos, unitId: unit.id });

    store.pick(null);

    expect(store.selectedUnitId).toBeNull();
    expect(store.state).toBe(before);
    expect(store.highlights.reach).toEqual([]);
  });

  it('ends the turn and clears the selection', () => {
    const store = startedStore();
    const { unit } = movableUnit(store);
    store.pick({ hex: unit.pos, unitId: unit.id });

    store.endTurn();

    expect(store.state?.activePlayer).toBe(1);
    expect(store.selectedUnitId).toBeNull();
    expect(store.played?.events.map((event) => event.type)).toContain('TurnStarted');
  });

  it('keeps the state and remembers why a command was refused', () => {
    const store = startedStore();
    const before = store.state;

    expect(store.send({ type: 'EndDeployment' })).toBe(false);

    expect(store.state).toBe(before);
    expect(store.rejection?.code).toBe('wrongPhase');
  });
});
