import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import type { AiState, Difficulty } from '@vermont/ai';
import { createAi, fallbackCommands } from '@vermont/ai';
import {
  PLAYER_SLOTS,
  SCENARIOS,
  abilityOf,
  adjacentUnits,
  attackTargets,
  autoDeployment,
  deploymentHexes,
  dispatch,
  eventsSeenBy,
  fieldedUnits,
  hexEquals,
  hexKey,
  isFielded,
  isFighting,
  isFogLifted,
  opponentOf,
  pathFromReach,
  playerView,
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
  PlayerView,
  Reach,
  Rejection,
  ScenarioDef,
  StartedBattle,
  TerrainDef,
  Unit,
} from '@vermont/core';
import type { Highlights, MapPick, VisibleHexes } from '@vermont/render';
import type { AiBrain } from '../ai/brain';
import { createBrain, createLocalBrain } from '../ai/brain';
import type { LogEntry } from '../battle/log';
import { describeEvents } from '../battle/log';
import type { DeploymentMode, SavedGame } from '../save/savedGame';
import { SaveError, createSavedGame } from '../save/savedGame';

export type { DeploymentMode } from '../save/savedGame';

/** What the player at the screen is shown of the battle. */
export interface Shown {
  /** The battle as that player knows it. */
  readonly state: BattleState;
  /** Hexes the player sees; `null` when nothing lies in the fog. */
  readonly visible: VisibleHexes;
}

/** What a carried-out command did, for the renderer to animate. */
export interface PlayedEvents extends Shown {
  /** The events the player at the screen witnessed; `state` is what they know after them. */
  readonly events: readonly GameEvent[];
  /**
   * Set when another player took the screen over: what to show, without animation, before
   * the events, so that nothing the previous player saw stays on the map.
   */
  readonly from?: Shown;
}

/** The computer as one of the two players. */
export interface ComputerPlayer {
  /** The side the computer plays; the other one is the player's at the screen. */
  readonly player: PlayerSlot;
  readonly difficulty: Difficulty;
  /** What does the thinking; a Web Worker when left out. */
  readonly brain?: AiBrain;
  /** Pause after each command of the computer the player saw, so that its turn can be followed. */
  readonly stepDelayMs?: number;
}

export interface StartOptions {
  readonly deployment?: DeploymentMode;
  /** Whether each player sees only what their units see; on when left out. */
  readonly fog?: boolean;
  /** Set when one side is played by the computer; two players share the screen otherwise. */
  readonly ai?: ComputerPlayer;
}

/** The computer player of the battle in progress. */
interface Computer {
  readonly player: PlayerSlot;
  readonly ai: AiState;
  readonly brain: AiBrain;
  readonly stepDelayMs: number;
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
  /** The hex lies in the fog: whatever stands there is not shown. */
  readonly fogged: boolean;
}

type Logs = Readonly<Record<PlayerSlot, readonly LogEntry[]>>;

/** A battle to put on the screen: a new one, or a saved one played up to where it was left. */
interface OpenedBattle extends StartedBattle {
  readonly scenario: ScenarioDef;
  readonly seed: number;
  readonly options: StartOptions;
  /** The computer player named in `options`, as it starts or as it was saved. */
  readonly ai: AiState | null;
  readonly commands?: readonly Command[];
  readonly logs?: Logs;
}

/** What a list of commands did, or why the core refused one of them. */
type Played =
  | {
      readonly ok: true;
      readonly state: BattleState;
      /** The events each player witnessed. */
      readonly witnessed: Readonly<Record<PlayerSlot, readonly GameEvent[]>>;
    }
  | { readonly ok: false; readonly rejection: Rejection };

/** Where the game was before a command that can be taken back. */
interface UndoStep {
  readonly state: BattleState;
  readonly commandCount: number;
  readonly logLengths: Readonly<Record<PlayerSlot, number>>;
  readonly selectedUnitId: string | null;
}

const DEFAULT_SCENARIO_ID = 'trebia';
const NO_LOGS: Logs = { 0: [], 1: [] };
const AI_STEP_DELAY_MS = 300;

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Commands a player may take back. Nothing with a roll of the dice is among them, so undo can
 * never be used to try an attack again.
 */
const UNDOABLE_COMMANDS: readonly CommandType[] = ['MoveUnit', 'DeployUnit'];

/**
 * A thin layer over the core: it holds the current battle, turns clicks into commands and asks
 * the core what is possible. It never works out the rules itself. Everything shown is the view
 * of one player, `viewer`: two players share the screen and take turns at it, or one plays
 * the computer and the screen stays theirs.
 */
export const useBattleStore = defineStore('battle', () => {
  const scenario = shallowRef<ScenarioDef | null>(null);
  const defs = shallowRef<BattleDefs | null>(null);
  /** The whole battle. Only the core is asked about it; the screen shows `known`. */
  const state = shallowRef<BattleState | null>(null);
  const played = shallowRef<PlayedEvents | null>(null);
  const rejection = shallowRef<Rejection | null>(null);
  const logs = shallowRef<Logs>(NO_LOGS);
  const undoSteps = shallowRef<readonly UndoStep[]>([]);
  const startOptions = shallowRef<StartOptions>({});
  const seed = ref(0);
  /** Every command carried out since the battle started; with the seed it replays the battle. */
  const history = shallowRef<readonly Command[]>([]);
  const selectedUnitId = ref<string | null>(null);
  const hoveredHex = shallowRef<Hex | null>(null);
  const order = ref<OrderMode>('move');
  /** The player whose view of the battle is on the screen. */
  const viewer = ref<PlayerSlot>(0);
  /** The player asked to sit down at the screen; the map stays covered until they do. */
  const handover = ref<PlayerSlot | null>(null);
  const computer = shallowRef<Computer | null>(null);
  /** Counts the battles started, so that an answer of the AI to an earlier one is dropped. */
  let battleNumber = 0;
  /** The battle the computer is giving its commands in right now, if any. */
  let computerPlaysIn: number | null = null;

  /** Whether the computer is on the move; the player at the screen can only watch then. */
  const aiOnTurn = computed(() => {
    const battle = state.value;
    return (
      !!battle &&
      battle.phase !== 'ended' &&
      computer.value !== null &&
      battle.activePlayer === computer.value.player
    );
  });

  const view = computed<PlayerView | null>(() =>
    state.value && defs.value ? playerView(state.value, defs.value, viewer.value) : null
  );

  /** The battle as the player at the screen knows it. */
  const known = computed<BattleState | null>(() => view.value?.state ?? null);

  const shown = computed<Shown | null>(() =>
    state.value && defs.value ? shownTo(state.value, defs.value, viewer.value) : null
  );

  /** What the player at the screen has witnessed so far. */
  const log = computed<readonly LogEntry[]>(() => logs.value[viewer.value]);

  /** The unit the active player has picked: one to deploy before the battle, one to command in it. */
  const selectedUnit = computed<Unit | null>(() => {
    const battle = known.value;
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
    return known.value?.phase === 'battle' && unit && isFielded(unit) ? unit : null;
  });

  /** Where the selected unit can go as far as its player knows; the fog may hold surprises. */
  const reach = computed<Reach | null>(() =>
    known.value && defs.value && commandedUnit.value
      ? unitReach(known.value, defs.value, commandedUnit.value)
      : null
  );

  const targets = computed<FieldedUnit[]>(() => {
    const unit = commandedUnit.value;
    if (!known.value || !defs.value || !unit || unit.hasAttacked) return [];
    return attackTargets(known.value, defs.value, unit);
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
    if (!known.value || !defs.value || !unit || known.value.phase !== 'deployment') return [];
    return deploymentHexes(known.value, defs.value, unit);
  });

  /** Units the active player has not put on the map yet. */
  const reserve = computed<Unit[]>(() =>
    known.value?.phase === 'deployment' ? reserveUnits(known.value, known.value.activePlayer) : []
  );

  /** Units of the active player that can still move or attack this turn. */
  const readyUnits = computed<FieldedUnit[]>(() => {
    const battle = known.value;
    const battleDefs = defs.value;
    if (!battle || !battleDefs || battle.phase !== 'battle' || aiOnTurn.value) return [];
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
    const battle = known.value;
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
    const battle = known.value;
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
      fogged: shown.value?.visible ? !shown.value.visible.has(hexKey(target)) : false,
    };
  });

  const canUndo = computed(() => undoSteps.value.length > 0);

  /** The battle as it is saved: how it was started and what was ordered since. */
  const savedGame = computed<SavedGame | null>(() => {
    if (!scenario.value || !defs.value) return null;
    return createSavedGame({
      scenarioId: scenario.value.id,
      seed: seed.value,
      deployment: startOptions.value.deployment ?? 'manual',
      fog: defs.value.rules.fog.enabled,
      computer: computer.value && { player: computer.value.player, state: computer.value.ai },
      commands: history.value,
    });
  });

  /** Puts a battle on the screen in place of whatever was there. */
  function open(opened: OpenedBattle): void {
    scenario.value = opened.scenario;
    defs.value = opened.defs;
    state.value = opened.state;
    startOptions.value = opened.options;
    seed.value = opened.seed;
    history.value = opened.commands ?? [];
    played.value = null;
    rejection.value = null;
    logs.value = opened.logs ?? NO_LOGS;
    undoSteps.value = [];
    hoveredHex.value = null;
    order.value = 'move';
    selectedUnitId.value = null;
    viewer.value = opened.state.activePlayer;
    handover.value = null;
    battleNumber++;
    computer.value?.brain.dispose();
    computer.value = null;

    const { ai } = opened.options;
    if (ai && opened.ai) {
      const brain = ai.brain ?? createBrain();
      brain.begin(opened.defs);
      computer.value = {
        player: ai.player,
        ai: opened.ai,
        brain,
        stepDelayMs: ai.stepDelayMs ?? AI_STEP_DELAY_MS,
      };
      viewer.value = opponentOf(ai.player);
    }
  }

  /**
   * Starts a scenario. With `deployment: 'auto'` both armies are put on the map by the game and
   * the battle begins at once; otherwise the players deploy by hand.
   */
  function start(
    battleSeed: number,
    scenarioId: string = DEFAULT_SCENARIO_ID,
    options: StartOptions = {}
  ): void {
    const chosen = Object.hasOwn(SCENARIOS, scenarioId) ? SCENARIOS[scenarioId] : undefined;
    if (!chosen) throw new Error(`Unknown scenario: "${scenarioId}"`);

    const begun = begin(chosen, battleSeed, options.fog);
    open({
      ...begun,
      scenario: chosen,
      seed: battleSeed,
      options,
      ai: options.ai ? createAi(options.ai.difficulty, battleSeed) : null,
    });

    if (options.ai) {
      advance();
      // Whatever the game did at once is shown as the battle's start, not played out.
      played.value = null;
    } else if (options.deployment === 'auto') {
      while (state.value?.phase === 'deployment') {
        const deployed = carryOut([
          ...autoDeployment(state.value, begun.defs),
          { type: 'EndDeployment' },
        ]);
        if (!deployed) throw new Error(`Scenario "${chosen.id}" could not be deployed`);
      }
      // The battle is shown as it starts; there is nothing to animate or take back, and the
      // player who moves first is the one who started it.
      played.value = null;
      handover.value = null;
    } else {
      selectedUnitId.value = reserve.value[0]?.id ?? null;
    }
  }

  /**
   * Picks a saved battle up where it was left, by playing it again from its seed and commands.
   * Throws a `SaveError`, and leaves the battle on the screen alone, when that cannot be done.
   */
  function load(saved: SavedGame, hooks: Pick<ComputerPlayer, 'brain' | 'stepDelayMs'> = {}): void {
    const chosen = Object.hasOwn(SCENARIOS, saved.scenarioId)
      ? SCENARIOS[saved.scenarioId]
      : undefined;
    if (!chosen) throw new SaveError('damaged', `Unknown scenario: "${saved.scenarioId}"`);

    const replayed = replay(chosen, saved);
    const { computer: savedComputer } = saved;
    open({
      ...replayed,
      scenario: chosen,
      seed: saved.seed,
      options: {
        deployment: saved.deployment,
        fog: saved.fog,
        ...(savedComputer && {
          ai: {
            player: savedComputer.player,
            difficulty: savedComputer.state.difficulty,
            ...hooks,
          },
        }),
      },
      ai: savedComputer?.state ?? null,
      commands: saved.commands,
    });

    if (computer.value) {
      advance();
      played.value = null;
      return;
    }
    // Two players sharing the screen: whoever is on the move has to sit down at it first.
    const { state: battle, defs: battleDefs } = replayed;
    if (battle.phase !== 'ended' && !isFogLifted(battle, battleDefs)) {
      handover.value = battle.activePlayer;
    }
    if (battle.phase === 'deployment') selectedUnitId.value = reserve.value[0]?.id ?? null;
  }

  /** Starts the same scenario again, from the beginning. */
  function restart(battleSeed: number): void {
    if (scenario.value) start(battleSeed, scenario.value.id, startOptions.value);
  }

  /** Leaves the battle; nothing of it is kept. */
  function leave(): void {
    battleNumber++;
    computer.value?.brain.dispose();
    computer.value = null;
    scenario.value = null;
    defs.value = null;
    state.value = null;
    played.value = null;
    rejection.value = null;
    logs.value = NO_LOGS;
    history.value = [];
    undoSteps.value = [];
    selectedUnitId.value = null;
    hoveredHex.value = null;
    order.value = 'move';
    viewer.value = 0;
    handover.value = null;
  }

  /**
   * Sends the commands to the core as one step: all of them are carried out, or none. Returns
   * whether they were.
   */
  function carryOut(commands: readonly Command[]): boolean {
    const before = state.value;
    const battleDefs = defs.value;
    if (!before || !battleDefs || !scenario.value) return false;

    const result = play(before, commands, battleDefs);
    if (!result.ok) {
      rejection.value = result.rejection;
      return false;
    }
    const { state: after, witnessed } = result;

    const step: UndoStep = {
      state: before,
      commandCount: history.value.length,
      logLengths: { 0: logs.value[0].length, 1: logs.value[1].length },
      selectedUnitId: selectedUnitId.value,
    };
    const takeBack =
      before.activePlayer !== computer.value?.player &&
      canTakeBack(commands, before, after) &&
      !learnedOfEnemy(before, after, battleDefs, witnessed[before.activePlayer]);
    undoSteps.value = takeBack ? [...undoSteps.value, step] : [];
    rejection.value = null;
    order.value = 'move';
    state.value = after;
    history.value = [...history.value, ...commands];

    // The screen goes to whoever is on the move; with the fog on they have to sit down first.
    // Against the computer it never changes hands.
    const changesHands =
      !computer.value && after.phase !== 'ended' && after.activePlayer !== viewer.value;
    if (changesHands) {
      viewer.value = after.activePlayer;
      handover.value = isFogLifted(after, battleDefs) ? null : after.activePlayer;
    }
    played.value = {
      ...shownTo(after, battleDefs, viewer.value),
      events: witnessed[viewer.value],
      ...(changesHands && { from: shownTo(before, battleDefs, viewer.value) }),
    };

    const context = { scenario: scenario.value, defs: battleDefs, before, after };
    logs.value = {
      0: [...logs.value[0], ...describeEvents(witnessed[0], context)],
      1: [...logs.value[1], ...describeEvents(witnessed[1], context)],
    };
    advance();
    return true;
  }

  /**
   * What the game does by itself after a command in a battle against the computer: it lets the
   * computer play when it is on the move, and deploys for a player who left that to the game.
   */
  function advance(): void {
    const battle = state.value;
    const battleDefs = defs.value;
    if (!computer.value || !battle || !battleDefs || battle.phase === 'ended') return;

    if (battle.activePlayer === computer.value.player) {
      void playComputer();
    } else if (battle.phase === 'deployment') {
      if (startOptions.value.deployment === 'auto') {
        carryOut([...autoDeployment(battle, battleDefs), { type: 'EndDeployment' }]);
      } else if (!selectedUnit.value) {
        selectedUnitId.value = reserve.value[0]?.id ?? null;
      }
    }
  }

  /**
   * The computer gives its commands one by one until the move is the player's again. It is
   * asked with its own view of the battle only, and its commands go the way the player's do.
   */
  async function playComputer(): Promise<void> {
    const playedBattle = battleNumber;
    if (computerPlaysIn === playedBattle) return;
    computerPlaysIn = playedBattle;
    try {
      while (aiOnTurn.value && state.value && defs.value && computer.value) {
        const battle = state.value;
        const battleDefs = defs.value;
        const { player, ai, brain, stepDelayMs } = computer.value;
        let command: Command | null = null;
        try {
          const decision = await brain.decide(playerView(battle, battleDefs, player), ai);
          if (playedBattle !== battleNumber) return;
          computer.value = { ...computer.value, ai: decision.ai };
          command = decision.command;
        } catch {
          if (playedBattle !== battleNumber) return;
          // A worker that cannot be started or has failed is replaced for the rest of the battle.
          brain.dispose();
          const local = createLocalBrain();
          local.begin(battleDefs);
          computer.value = { ...computer.value, brain: local };
        }
        if (!command || !carryOut([command])) {
          carryOut(fallbackCommands(battle, battleDefs));
          rejection.value = null;
        }
        // Only what the player saw happen is worth a pause; the rest goes by at once.
        const witnessed = played.value?.events.length ?? 0;
        if (stepDelayMs > 0 && witnessed > 0) await pause(stepDelayMs);
        if (playedBattle !== battleNumber) return;
      }
    } finally {
      if (computerPlaysIn === playedBattle) computerPlaysIn = null;
    }
  }

  /** Sends a command to the core; returns whether it was carried out. */
  function send(command: Command): boolean {
    return carryOut([command]);
  }

  /** Takes back the last move or deployment of this turn; returns whether there was one. */
  function undo(): boolean {
    const step = undoSteps.value.at(-1);
    if (!step || !defs.value || aiOnTurn.value) return false;
    undoSteps.value = undoSteps.value.slice(0, -1);
    state.value = step.state;
    history.value = history.value.slice(0, step.commandCount);
    // No events: the renderer just shows the earlier state.
    played.value = { ...shownTo(step.state, defs.value, viewer.value), events: [] };
    logs.value = {
      0: logs.value[0].slice(0, step.logLengths[0]),
      1: logs.value[1].slice(0, step.logLengths[1]),
    };
    selectedUnitId.value = step.selectedUnitId;
    rejection.value = null;
    order.value = 'move';
    return true;
  }

  /** The player who was asked to the screen has sat down; the map is uncovered for them. */
  function takeSeat(): void {
    handover.value = null;
  }

  /** The player clicked a hex or a unit on the map, or beside the map (`null`). */
  function pick(picked: MapPick | null): void {
    const battle = known.value;
    if (handover.value !== null || aiOnTurn.value) return;
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
    const candidates = known.value?.phase === 'deployment' ? reserve.value : readyUnits.value;
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
    if (aiOnTurn.value) return;
    if (send({ type: 'EndTurn' })) selectedUnitId.value = null;
  }

  /** Puts the units still in reserve on the map for the active player. */
  function autoDeploy(): void {
    if (!state.value || !defs.value || state.value.phase !== 'deployment' || aiOnTurn.value) return;
    const commands = autoDeployment(state.value, defs.value);
    if (commands.length > 0 && carryOut(commands)) selectedUnitId.value = null;
  }

  /** The active player is done deploying; the other player deploys next, or the battle starts. */
  function endDeployment(): void {
    if (aiOnTurn.value) return;
    if (send({ type: 'EndDeployment' })) selectedUnitId.value = reserve.value[0]?.id ?? null;
  }

  return {
    scenario,
    defs,
    state,
    known,
    shown,
    viewer,
    handover,
    aiOnTurn,
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
    savedGame,
    start,
    load,
    restart,
    leave,
    send,
    undo,
    takeSeat,
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

/** The scenario ready to be played from `seed`, with the fog as the players chose it. */
function begin(scenario: ScenarioDef, seed: number, fog: boolean | undefined): StartedBattle {
  const started = startScenario(scenario, seed);
  const { rules } = started.defs;
  return {
    state: started.state,
    defs: {
      ...started.defs,
      rules: { ...rules, fog: { ...rules.fog, enabled: fog ?? rules.fog.enabled } },
    },
  };
}

/** Sends the commands to the core one after another and notes what each player saw of them. */
function play(before: BattleState, commands: readonly Command[], defs: BattleDefs): Played {
  let state = before;
  const witnessed: Record<PlayerSlot, GameEvent[]> = { 0: [], 1: [] };
  for (const command of commands) {
    const result = dispatch(state, command, defs);
    if (!result.ok) return { ok: false, rejection: result.rejection };
    for (const player of PLAYER_SLOTS) {
      witnessed[player].push(...eventsSeenBy(result.events, state, result.state, defs, player));
    }
    state = result.state;
  }
  return { ok: true, state, witnessed };
}

/**
 * Plays a saved battle from its start to where it was left, and writes the log each player
 * would have by then. A save the core does not accept command by command is damaged.
 */
function replay(scenario: ScenarioDef, saved: SavedGame): StartedBattle & { logs: Logs } {
  try {
    const { state: begun, defs } = begin(scenario, saved.seed, saved.fog);
    let state = begun;
    const logs: Record<PlayerSlot, LogEntry[]> = { 0: [], 1: [] };
    for (const [index, command] of saved.commands.entries()) {
      const step = play(state, [command], defs);
      if (!step.ok) {
        throw new SaveError('damaged', `Saved command ${index}: ${step.rejection.message}`);
      }
      const context = { scenario, defs, before: state, after: step.state };
      for (const player of PLAYER_SLOTS) {
        logs[player].push(...describeEvents(step.witnessed[player], context));
      }
      state = step.state;
    }
    return { state, defs, logs };
  } catch (error) {
    if (error instanceof SaveError) throw error;
    // A command of the wrong shape can make a handler throw before it gets to reject it.
    throw new SaveError('damaged', 'The saved commands cannot be played again');
  }
}

function reliefCommand(unit: Unit, partner: Unit): Command {
  return { type: 'UseAbility', unitId: unit.id, abilityId: 'lineRelief', targetId: partner.id };
}

function shownTo(state: BattleState, defs: BattleDefs, player: PlayerSlot): Shown {
  const view = playerView(state, defs, player);
  return { state: view.state, visible: isFogLifted(state, defs) ? null : view.visible };
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

/**
 * Whether the step told the player who made it where an enemy is: a unit came into sight, or
 * one of theirs ran into it. What was learned cannot be unlearned, so such a step stays.
 */
function learnedOfEnemy(
  before: BattleState,
  after: BattleState,
  defs: BattleDefs,
  witnessed: readonly GameEvent[]
): boolean {
  const player = before.activePlayer;
  const sighted = (state: BattleState) =>
    fieldedUnits(playerView(state, defs, player).state)
      .filter((unit) => unit.owner !== player)
      .map((unit) => unit.id);
  const knownBefore = new Set(sighted(before));
  return (
    witnessed.some((event) => event.type === 'UnitAmbushed') ||
    sighted(after).some((unitId) => !knownBefore.has(unitId))
  );
}
