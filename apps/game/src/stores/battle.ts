import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  SCENARIOS,
  attackTargets,
  autoDeployment,
  dispatch,
  dispatchAll,
  hexEquals,
  isFighting,
  pathFromReach,
  startScenario,
  unitReach,
} from '@vermont/core';
import type {
  BattleDefs,
  BattleState,
  Command,
  FieldedUnit,
  GameEvent,
  Hex,
  Reach,
  Rejection,
  ScenarioDef,
} from '@vermont/core';
import type { Highlights, MapPick } from '@vermont/render';

/** What a carried-out command did, for the renderer to animate. */
export interface PlayedEvents {
  readonly events: readonly GameEvent[];
  /** The state after the events. */
  readonly state: BattleState;
}

const DEFAULT_SCENARIO_ID = 'trebia';

/**
 * A thin layer over the core: it holds the current battle, turns clicks into commands and asks
 * the core what is possible. It never works out the rules itself.
 */
export const useBattleStore = defineStore('battle', () => {
  const scenario = shallowRef<ScenarioDef | null>(null);
  const defs = shallowRef<BattleDefs | null>(null);
  const state = shallowRef<BattleState | null>(null);
  const played = shallowRef<PlayedEvents | null>(null);
  const rejection = shallowRef<Rejection | null>(null);
  const selectedUnitId = ref<string | null>(null);
  const hoveredHex = shallowRef<Hex | null>(null);

  const selectedUnit = computed<FieldedUnit | null>(() => {
    const unit = selectedUnitId.value ? state.value?.units[selectedUnitId.value] : undefined;
    return unit && isFighting(unit) ? unit : null;
  });

  const reach = computed<Reach | null>(() =>
    state.value && defs.value && selectedUnit.value
      ? unitReach(state.value, defs.value, selectedUnit.value)
      : null
  );

  const targets = computed<FieldedUnit[]>(() => {
    const unit = selectedUnit.value;
    if (!state.value || !defs.value || !unit || unit.hasAttacked) return [];
    return attackTargets(state.value, defs.value, unit);
  });

  /** The route the selected unit would take to the hex under the pointer. */
  const hoveredPath = computed<Hex[]>(() => {
    if (!reach.value || !hoveredHex.value) return [];
    return pathFromReach(reach.value, hoveredHex.value)?.hexes.slice(1) ?? [];
  });

  const highlights = computed<Highlights>(() => ({
    selected: selectedUnit.value?.pos ?? null,
    reach: [...(reach.value?.values() ?? [])]
      .filter((node) => node.canStop && node.cost > 0)
      .map((node) => node.hex),
    path: hoveredPath.value,
    targets: targets.value.map((target) => target.pos),
  }));

  /**
   * Starts a scenario with both armies deployed automatically, so the battle begins at once.
   * Deploying by hand comes with the user interface.
   */
  function start(seed: number, scenarioId: string = DEFAULT_SCENARIO_ID): void {
    const chosen = SCENARIOS[scenarioId];
    if (!chosen) throw new Error(`Unknown scenario: "${scenarioId}"`);

    const started = startScenario(chosen, seed);
    let current = started.state;
    while (current.phase === 'deployment') {
      const result = dispatchAll(
        current,
        [...autoDeployment(current, started.defs), { type: 'EndDeployment' }],
        started.defs
      );
      if (!result.ok) throw new Error(`Deployment failed: ${result.rejection.message}`);
      current = result.state;
    }

    scenario.value = chosen;
    defs.value = started.defs;
    state.value = current;
    played.value = null;
    rejection.value = null;
    selectedUnitId.value = null;
    hoveredHex.value = null;
  }

  /** Sends a command to the core; returns whether it was carried out. */
  function send(command: Command): boolean {
    if (!state.value || !defs.value) return false;
    const result = dispatch(state.value, command, defs.value);
    if (!result.ok) {
      rejection.value = result.rejection;
      return false;
    }
    rejection.value = null;
    state.value = result.state;
    played.value = { events: result.events, state: result.state };
    return true;
  }

  /** The player clicked a hex or a unit on the map, or beside the map (`null`). */
  function pick(picked: MapPick | null): void {
    const battle = state.value;
    if (!battle || battle.phase !== 'battle') return;

    const selected = selectedUnit.value;
    const clickedUnit = picked?.unitId ? battle.units[picked.unitId] : undefined;
    if (clickedUnit) {
      if (clickedUnit.owner === battle.activePlayer) {
        const selectable = isFighting(clickedUnit) && clickedUnit.id !== selected?.id;
        selectedUnitId.value = selectable ? clickedUnit.id : null;
      } else if (selected && targets.value.some((target) => target.id === clickedUnit.id)) {
        send({ type: 'Attack', unitId: selected.id, targetId: clickedUnit.id });
      } else {
        selectedUnitId.value = null;
      }
      return;
    }

    const path = picked && reach.value ? pathFromReach(reach.value, picked.hex) : null;
    if (selected && path && path.hexes.length > 1) {
      send({ type: 'MoveUnit', unitId: selected.id, path: path.hexes });
      return;
    }
    selectedUnitId.value = null;
  }

  function hover(target: Hex | null): void {
    const current = hoveredHex.value;
    if (target === current || (target && current && hexEquals(target, current))) return;
    hoveredHex.value = target;
  }

  function endTurn(): void {
    if (send({ type: 'EndTurn' })) selectedUnitId.value = null;
  }

  return {
    scenario,
    defs,
    state,
    played,
    rejection,
    selectedUnitId,
    selectedUnit,
    highlights,
    start,
    send,
    pick,
    hover,
    endTurn,
  };
});
