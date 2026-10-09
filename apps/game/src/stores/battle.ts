import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  SCENARIOS,
  abilityOf,
  adjacentUnits,
  attackTargets,
  autoDeployment,
  deploymentHexes,
  dispatch,
  dispatchAll,
  fieldedUnits,
  hexEquals,
  isFielded,
  isFighting,
  pathFromReach,
  previewAttack,
  reserveUnits,
  startScenario,
  terrainAt,
  unitAt,
  unitReach,
} from '@vermont/core';
import type {
  AttackPreview,
  BattleDefs,
  BattleState,
  Command,
  CommandType,
  FieldedUnit,
  GameEvent,
  Hex,
  PlayerSlot,
  Reach,
  Rejection,
  ScenarioDef,
  TerrainDef,
  Unit,
} from '@vermont/core';
import type { Highlights, MapPick } from '@vermont/render';
import type { LogEntry } from '../battle/log';
import { describeEvents } from '../battle/log';

/** What a carried-out command did, for the renderer to animate. */
export interface PlayedEvents {
  readonly events: readonly GameEvent[];
  /** The state after the events. */
  readonly state: BattleState;
}

/** Who puts the armies on the map before the battle: the players, or the game for them. */
export type DeploymentMode = 'manual' | 'auto';

export interface StartOptions {
  readonly deployment?: DeploymentMode;
}

/** What a click on the map orders the selected unit to do. */
export type OrderMode = 'move' | 'relief';

/** What is under the pointer, for the tooltip. */
export interface HoverInfo {
  readonly hex: Hex;
  readonly terrain: TerrainDef;
  readonly unit: FieldedUnit | null;
  /** Whose camp the hex is, if any. */
  readonly campOf: PlayerSlot | null;
  /** What attacking `unit` with the selected unit would do; `null` when it cannot be attacked. */
  readonly preview: AttackPreview | null;
}

/** Where the game was before a command that can be taken back. */
interface UndoStep {
  readonly state: BattleState;
  readonly logLength: number;
  readonly selectedUnitId: string | null;
}

const DEFAULT_SCENARIO_ID = 'trebia';

/**
 * Commands a player may take back. Nothing with a roll of the dice is among them, so undo can
 * never be used to try an attack again.
 */
const UNDOABLE_COMMANDS: readonly CommandType[] = ['MoveUnit', 'DeployUnit'];

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
  const log = shallowRef<readonly LogEntry[]>([]);
  const undoSteps = shallowRef<readonly UndoStep[]>([]);
  const startOptions = shallowRef<StartOptions>({});
  const selectedUnitId = ref<string | null>(null);
  const hoveredHex = shallowRef<Hex | null>(null);
  const order = ref<OrderMode>('move');

  /** The unit the active player has picked: one to deploy before the battle, one to command in it. */
  const selectedUnit = computed<Unit | null>(() => {
    const battle = state.value;
    const unit = battle && selectedUnitId.value ? battle.units[selectedUnitId.value] : undefined;
    if (!battle || !unit || unit.owner !== battle.activePlayer) return null;
    if (battle.phase === 'deployment') {
      return unit.status === 'reserve' || isFielded(unit) ? unit : null;
    }
    return battle.phase === 'battle' && isFighting(unit) ? unit : null;
  });

  /** The selected unit when it can be given orders in the battle. */
  const commandedUnit = computed<FieldedUnit | null>(() => {
    const unit = selectedUnit.value;
    return state.value?.phase === 'battle' && unit && isFielded(unit) ? unit : null;
  });

  const reach = computed<Reach | null>(() =>
    state.value && defs.value && commandedUnit.value
      ? unitReach(state.value, defs.value, commandedUnit.value)
      : null
  );

  const targets = computed<FieldedUnit[]>(() => {
    const unit = commandedUnit.value;
    if (!state.value || !defs.value || !unit || unit.hasAttacked) return [];
    return attackTargets(state.value, defs.value, unit);
  });

  /** Units the selected unit may change places with; the core is asked by trying the command. */
  const reliefPartners = computed<FieldedUnit[]>(() => {
    const battle = state.value;
    const battleDefs = defs.value;
    const unit = commandedUnit.value;
    if (!battle || !battleDefs || !unit || !abilityOf(battleDefs, unit, 'lineRelief')) return [];
    return adjacentUnits(battle, unit.pos, unit.owner).filter(
      (partner) => dispatch(battle, reliefCommand(unit, partner), battleDefs).ok
    );
  });

  /** Hexes the selected unit can be deployed on. */
  const deploymentTargets = computed<Hex[]>(() => {
    const unit = selectedUnit.value;
    if (!state.value || !defs.value || !unit || state.value.phase !== 'deployment') return [];
    return deploymentHexes(state.value, defs.value, unit);
  });

  /** Units the active player has not put on the map yet. */
  const reserve = computed<Unit[]>(() =>
    state.value?.phase === 'deployment' ? reserveUnits(state.value, state.value.activePlayer) : []
  );

  /** Units of the active player that can still move or attack this turn. */
  const readyUnits = computed<FieldedUnit[]>(() => {
    const battle = state.value;
    const battleDefs = defs.value;
    if (!battle || !battleDefs || battle.phase !== 'battle') return [];
    return fieldedUnits(battle, battle.activePlayer).filter(
      (unit) => isFighting(unit) && canAct(battle, battleDefs, unit)
    );
  });

  /** The route the selected unit would take to the hex under the pointer. */
  const hoveredPath = computed<Hex[]>(() => {
    if (!reach.value || !hoveredHex.value) return [];
    return pathFromReach(reach.value, hoveredHex.value)?.hexes.slice(1) ?? [];
  });

  const highlights = computed<Highlights>(() => {
    const battle = state.value;
    const selected = selectedUnit.value?.pos ?? null;
    if (battle?.phase === 'deployment') {
      const hovered = hoveredHex.value;
      const free = deploymentTargets.value;
      return {
        selected,
        // With no unit picked the whole zone is marked, so the player sees where it is.
        reach: selectedUnit.value ? free : (defs.value?.deploymentZones[battle.activePlayer] ?? []),
        path: hovered && free.some((target) => hexEquals(target, hovered)) ? [hovered] : [],
        targets: [],
      };
    }
    if (order.value === 'relief') {
      return {
        selected,
        reach: reliefPartners.value.map((partner) => partner.pos),
        path: [],
        targets: [],
      };
    }
    return {
      selected,
      reach: [...(reach.value?.values() ?? [])]
        .filter((node) => node.canStop && node.cost > 0)
        .map((node) => node.hex),
      path: hoveredPath.value,
      targets: targets.value.map((target) => target.pos),
    };
  });

  const hoverInfo = computed<HoverInfo | null>(() => {
    const battle = state.value;
    const battleDefs = defs.value;
    const target = hoveredHex.value;
    const terrain = battleDefs && target && terrainAt(battleDefs.map, battleDefs.terrains, target);
    if (!battle || !battleDefs || !target || !terrain) return null;

    const unit = unitAt(battle, target) ?? null;
    const attacker = commandedUnit.value;
    const attackable = unit && targets.value.some((candidate) => candidate.id === unit.id);
    const preview =
      attacker && attackable ? previewAttack(battle, battleDefs, attacker, unit) : null;
    const camps = Object.entries(battleDefs.camps) as [`${PlayerSlot}`, Hex][];
    const camp = camps.find(([, campHex]) => hexEquals(campHex, target));
    return {
      hex: target,
      terrain,
      unit,
      campOf: camp ? (Number(camp[0]) as PlayerSlot) : null,
      preview: preview && 'kind' in preview ? preview : null,
    };
  });

  const canUndo = computed(() => undoSteps.value.length > 0);

  /**
   * Starts a scenario. With `deployment: 'auto'` both armies are put on the map by the game and
   * the battle begins at once; otherwise the players deploy by hand.
   */
  function start(
    seed: number,
    scenarioId: string = DEFAULT_SCENARIO_ID,
    options: StartOptions = {}
  ): void {
    const chosen = Object.hasOwn(SCENARIOS, scenarioId) ? SCENARIOS[scenarioId] : undefined;
    if (!chosen) throw new Error(`Unknown scenario: "${scenarioId}"`);

    const started = startScenario(chosen, seed);
    scenario.value = chosen;
    defs.value = started.defs;
    state.value = started.state;
    startOptions.value = options;
    played.value = null;
    rejection.value = null;
    log.value = [];
    undoSteps.value = [];
    hoveredHex.value = null;
    order.value = 'move';
    selectedUnitId.value = null;

    if (options.deployment === 'auto') {
      while (state.value.phase === 'deployment') {
        const deployed = carryOut([
          ...autoDeployment(state.value, started.defs),
          { type: 'EndDeployment' },
        ]);
        if (!deployed) throw new Error(`Scenario "${chosen.id}" could not be deployed`);
      }
      // The battle is shown as it starts; there is nothing to animate or take back.
      played.value = null;
    } else {
      selectedUnitId.value = reserve.value[0]?.id ?? null;
    }
  }

  /** Starts the same scenario again, from the beginning. */
  function restart(seed: number): void {
    if (scenario.value) start(seed, scenario.value.id, startOptions.value);
  }

  /** Leaves the battle; nothing of it is kept. */
  function leave(): void {
    scenario.value = null;
    defs.value = null;
    state.value = null;
    played.value = null;
    rejection.value = null;
    log.value = [];
    undoSteps.value = [];
    selectedUnitId.value = null;
    hoveredHex.value = null;
    order.value = 'move';
  }

  /**
   * Sends the commands to the core as one step: all of them are carried out, or none. Returns
   * whether they were.
   */
  function carryOut(commands: readonly Command[]): boolean {
    const before = state.value;
    if (!before || !defs.value || !scenario.value) return false;
    const result = dispatchAll(before, commands, defs.value);
    if (!result.ok) {
      rejection.value = result.rejection;
      return false;
    }
    const step: UndoStep = {
      state: before,
      logLength: log.value.length,
      selectedUnitId: selectedUnitId.value,
    };
    undoSteps.value = canTakeBack(commands, before, result.state) ? [...undoSteps.value, step] : [];
    rejection.value = null;
    order.value = 'move';
    state.value = result.state;
    played.value = { events: result.events, state: result.state };
    log.value = [
      ...log.value,
      ...describeEvents(result.events, {
        scenario: scenario.value,
        defs: defs.value,
        before,
        after: result.state,
      }),
    ];
    return true;
  }

  /** Sends a command to the core; returns whether it was carried out. */
  function send(command: Command): boolean {
    return carryOut([command]);
  }

  /** Takes back the last move or deployment of this turn; returns whether there was one. */
  function undo(): boolean {
    const step = undoSteps.value.at(-1);
    if (!step) return false;
    undoSteps.value = undoSteps.value.slice(0, -1);
    state.value = step.state;
    // No events: the renderer just shows the earlier state.
    played.value = { events: [], state: step.state };
    log.value = log.value.slice(0, step.logLength);
    selectedUnitId.value = step.selectedUnitId;
    rejection.value = null;
    order.value = 'move';
    return true;
  }

  /** The player clicked a hex or a unit on the map, or beside the map (`null`). */
  function pick(picked: MapPick | null): void {
    const battle = state.value;
    if (battle?.phase === 'deployment') pickInDeployment(battle, picked);
    else if (battle?.phase === 'battle') pickInBattle(battle, picked);
  }

  function pickInDeployment(battle: BattleState, picked: MapPick | null): void {
    if (!picked) {
      selectedUnitId.value = null;
      return;
    }
    const clickedUnit = picked.unitId ? battle.units[picked.unitId] : undefined;
    if (clickedUnit) {
      if (clickedUnit.owner === battle.activePlayer) toggleSelection(clickedUnit.id);
      return;
    }
    const unit = selectedUnit.value;
    if (!unit || !deploymentTargets.value.some((target) => hexEquals(target, picked.hex))) return;

    const cameFromReserve = unit.status === 'reserve';
    if (send({ type: 'DeployUnit', unitId: unit.id, hex: picked.hex })) {
      // The next waiting unit is picked at once, so an army is deployed click by click.
      selectedUnitId.value = cameFromReserve ? (reserve.value[0]?.id ?? null) : null;
    }
  }

  function pickInBattle(battle: BattleState, picked: MapPick | null): void {
    const selected = commandedUnit.value;
    const clickedUnit = picked?.unitId ? battle.units[picked.unitId] : undefined;

    if (order.value === 'relief') {
      order.value = 'move';
      const partner = reliefPartners.value.find((candidate) => candidate.id === clickedUnit?.id);
      if (selected && partner) {
        send(reliefCommand(selected, partner));
        return;
      }
    }

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

  function toggleSelection(unitId: string): void {
    selectedUnitId.value = selectedUnitId.value === unitId ? null : unitId;
  }

  /** Picks a unit from a list in the interface, or drops the selection with `null`. */
  function select(unitId: string | null): void {
    selectedUnitId.value = unitId;
    order.value = 'move';
  }

  /**
   * Picks the next unit that still has something to do: one waiting in reserve before the
   * battle, one that can move or attack in it. `step` -1 goes the other way round.
   */
  function selectNext(step: 1 | -1 = 1): void {
    const candidates = state.value?.phase === 'deployment' ? reserve.value : readyUnits.value;
    if (candidates.length === 0) return;
    const current = candidates.findIndex((unit) => unit.id === selectedUnitId.value);
    const start = current === -1 && step === -1 ? 0 : current;
    select(candidates[(start + step + candidates.length) % candidates.length]!.id);
  }

  function hover(target: Hex | null): void {
    const current = hoveredHex.value;
    if (target === current || (target && current && hexEquals(target, current))) return;
    hoveredHex.value = target;
  }

  /** Switches between ordering a move and ordering the selected unit to change places. */
  function toggleRelief(): void {
    if (order.value === 'relief') order.value = 'move';
    else if (reliefPartners.value.length > 0) order.value = 'relief';
  }

  function endTurn(): void {
    if (send({ type: 'EndTurn' })) selectedUnitId.value = null;
  }

  /** Puts the units still in reserve on the map for the active player. */
  function autoDeploy(): void {
    if (!state.value || !defs.value || state.value.phase !== 'deployment') return;
    const commands = autoDeployment(state.value, defs.value);
    if (commands.length > 0 && carryOut(commands)) selectedUnitId.value = null;
  }

  /** The active player is done deploying; the other player deploys next, or the battle starts. */
  function endDeployment(): void {
    if (send({ type: 'EndDeployment' })) selectedUnitId.value = reserve.value[0]?.id ?? null;
  }

  return {
    scenario,
    defs,
    state,
    played,
    rejection,
    log,
    order,
    selectedUnitId,
    selectedUnit,
    commandedUnit,
    reliefPartners,
    reserve,
    readyUnits,
    highlights,
    hoverInfo,
    canUndo,
    start,
    restart,
    leave,
    send,
    undo,
    pick,
    select,
    selectNext,
    hover,
    toggleRelief,
    endTurn,
    autoDeploy,
    endDeployment,
  };
});

function reliefCommand(unit: Unit, partner: Unit): Command {
  return { type: 'UseAbility', unitId: unit.id, abilityId: 'lineRelief', targetId: partner.id };
}

/** Whether the unit still has somewhere to go or somebody to attack this turn. */
function canAct(state: BattleState, defs: BattleDefs, unit: FieldedUnit): boolean {
  if (!unit.hasAttacked && attackTargets(state, defs, unit).length > 0) return true;
  for (const node of unitReach(state, defs, unit).values()) {
    if (node.canStop && node.cost > 0) return true;
  }
  return false;
}

/**
 * Whether the step may be taken back: only moves and deployments, and only while nothing was
 * rolled and the phase did not change (a move into the enemy camp ends the battle for good).
 */
function canTakeBack(
  commands: readonly Command[],
  before: BattleState,
  after: BattleState
): boolean {
  return (
    commands.every((command) => UNDOABLE_COMMANDS.includes(command.type)) &&
    after.phase === before.phase &&
    after.rng === before.rng
  );
}
