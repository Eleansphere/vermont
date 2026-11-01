<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PLAYER_SLOTS } from '@vermont/core';
import { battleSummary, sideColor, sideName } from '../battle/labels';
import type { ShortcutAction } from '../battle/shortcuts';
import { shortcutFor } from '../battle/shortcuts';
import { plural, rejectionText, t, victoryReasonText } from '../i18n';
import { downloadSave } from '../save/storage';
import { useBattleStore } from '../stores/battle';
import { useSettingsStore } from '../stores/settings';
import ArmyBar from './ArmyBar.vue';
import BattleHud from './BattleHud.vue';
import DeploymentPanel from './DeploymentPanel.vue';
import EventLog from './EventLog.vue';
import GameDialog from './GameDialog.vue';
import HexTooltip from './HexTooltip.vue';
import SettingsPanel from './SettingsPanel.vue';

// The canvas brings Three.js and the renderer, so they load when the first battle starts.
const BattleCanvas = defineAsyncComponent(() => import('./BattleCanvas.vue'));
import RotateHint from './RotateHint.vue';
import RulesHelp from './RulesHelp.vue';
import TurnSummary from './TurnSummary.vue';
import TutorialCoach from './TutorialCoach.vue';
import UnitPanel from './UnitPanel.vue';

const emit = defineEmits<{ mainMenu: [] }>();

const store = useBattleStore();
const settings = useSettingsStore();

/** The dialog over the battle, if any; the map takes no orders while one is open. */
type Overlay = 'pause' | 'settings' | 'help' | 'confirmEndTurn';
const overlay = ref<Overlay | null>(null);
/** The result is shown once and can be put away to look at the field. */
const resultDismissed = ref(false);
const pointer = ref({ x: 0, y: 0 });

/** How the battle ended, in words: a victory of one side, or a draw. */
const result = computed(() => {
  const { state, scenario, defs } = store;
  if (!state || !scenario || !defs) return null;
  if (state.draw) {
    return {
      title: t('draw.title'),
      text: t('log.battleDrawn', { rounds: defs.rules.roundLimit }),
      color: 'var(--panel-border)',
    };
  }
  if (!state.winner) return null;
  const side = sideName(scenario, state.winner.player);
  return {
    title: t('victory.title', { side }),
    text: t('log.battleEnded', { side, reason: victoryReasonText(state.winner.reason) }),
    color: sideColor(state.winner.player),
  };
});
/** What the battle cost both sides, for the result dialog. */
const summary = computed(() => {
  const { state, scenario } = store;
  if (!state || !scenario || state.phase !== 'ended') return [];
  return PLAYER_SLOTS.map((player) => ({
    ...battleSummary(state, player),
    name: sideName(scenario, player),
    color: sideColor(player),
  }));
});

const showResult = computed(
  () => result.value !== null && !resultDismissed.value && !overlay.value
);

/** The player asked to the screen; until they sit down the battle is covered and takes no orders. */
const handover = computed(() => {
  const { handover: player, scenario, state } = store;
  if (player === null || !scenario || !state) return null;
  return {
    side: sideName(scenario, player),
    color: sideColor(player),
    task: t(state.phase === 'deployment' ? 'handover.deploy' : 'handover.turn', {
      turn: state.turn,
    }),
  };
});

watch(
  () => store.state?.phase,
  () => (resultDismissed.value = false)
);

function requestEndTurn(): void {
  if (store.aiOnTurn) return;
  const phase = store.state?.phase;
  if (phase === 'deployment') {
    if (store.reserve.length === 0) store.endDeployment();
  } else if (phase === 'battle') {
    if (settings.confirmEndTurn && store.readyUnits.length > 0) overlay.value = 'confirmEndTurn';
    else store.endTurn();
  }
}

function confirmEndTurn(): void {
  overlay.value = null;
  store.endTurn();
}

/** Escape steps back one thing at a time: the pending order, the selection, then the menu. */
function escape(): void {
  if (overlay.value) overlay.value = null;
  else if (store.order === 'relief') store.toggleRelief();
  else if (store.selectedUnitId) store.select(null);
  else overlay.value = 'pause';
}

/** Hands the battle to the player as a file named after the scenario and the round. */
function saveToFile(): void {
  const { savedGame, state } = store;
  if (savedGame && state) {
    downloadSave(savedGame, `vermont-${savedGame.scenarioId}-kolo-${state.turn}.json`);
  }
}

function restart(): void {
  overlay.value = null;
  store.restart(Date.now());
}

const ACTIONS: Readonly<Record<ShortcutAction, () => void>> = {
  endTurn: requestEndTurn,
  undo: () => store.undo(),
  next: () => store.selectNext(1),
  previous: () => store.selectNext(-1),
  relief: () => store.toggleRelief(),
  toggleLog: () => (settings.logOpen = !settings.logOpen),
  escape,
  help: () => (overlay.value = 'help'),
  show: () => store.showSelected(),
  terrain: () => store.toggleTerrain(),
};

function onKeyDown(event: KeyboardEvent): void {
  const action = shortcutFor(event);
  if (!action) return;
  if (handover.value) {
    if (action !== 'endTurn') return;
    store.takeSeat();
  } else if (overlay.value) {
    // A dialog only knows how to be confirmed or closed.
    if (action === 'escape') escape();
    else if (action === 'endTurn' && overlay.value === 'confirmEndTurn') confirmEndTurn();
    else return;
  } else {
    ACTIONS[action]();
  }
  event.preventDefault();
}

function onPointerMove(event: PointerEvent): void {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  pointer.value = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

/**
 * A button clicked with the mouse would keep the focus and swallow the next Enter, so the focus
 * goes back to the battle. Buttons reached by keyboard keep it.
 */
function onClick(event: MouseEvent): void {
  const focused = document.activeElement;
  if (event.detail > 0 && focused instanceof HTMLButtonElement) focused.blur();
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
</script>

<template>
  <main class="battle" @pointermove="onPointerMove" @pointerdown="onPointerMove" @click="onClick">
    <BattleCanvas />

    <BattleHud @end-turn="requestEndTurn" @menu="overlay = 'pause'" />
    <DeploymentPanel v-if="store.state?.phase === 'deployment'" />
    <UnitPanel />
    <ArmyBar v-if="!handover" />
    <EventLog v-if="settings.logOpen" />
    <TurnSummary v-if="!overlay && !handover" />
    <TutorialCoach v-if="!overlay && !handover" @main-menu="emit('mainMenu')" />
    <HexTooltip v-if="!overlay && !handover" :x="pointer.x" :y="pointer.y" />
    <RotateHint v-if="!overlay && !handover" />

    <p v-if="store.rejection" class="battle__rejection panel" role="alert" data-test="rejection">
      {{ rejectionText(store.rejection.code) }}
    </p>

    <GameDialog
      v-if="handover"
      class="battle__handover"
      :title="t('handover.title', { side: handover.side })"
      data-test="handover"
    >
      <p class="battle__text battle__side" :style="{ borderColor: handover.color }">
        {{ handover.task }}
      </p>
      <p class="battle__text muted">{{ t('handover.hint') }}</p>
      <button
        class="button button--primary button--wide"
        type="button"
        data-test="take-seat"
        @click="store.takeSeat()"
      >
        {{ t('handover.ready') }} <kbd>Enter</kbd>
      </button>
    </GameDialog>

    <GameDialog v-else-if="overlay === 'confirmEndTurn'" :title="t('hud.endTurn')">
      <p class="battle__text">
        {{ t('hud.confirmEndTurn', { count: store.readyUnits.length }) }}
      </p>
      <div class="battle__row">
        <button class="button" type="button" data-test="cancel" @click="overlay = null">
          {{ t('hud.cancel') }} <kbd>Esc</kbd>
        </button>
        <button
          class="button button--primary"
          type="button"
          data-test="confirm"
          @click="confirmEndTurn"
        >
          {{ t('hud.confirm') }} <kbd>Enter</kbd>
        </button>
      </div>
    </GameDialog>

    <GameDialog v-else-if="overlay === 'pause'" :title="t('menu.pause')">
      <button
        class="button button--primary button--wide"
        type="button"
        data-test="resume"
        @click="overlay = null"
      >
        {{ t('menu.resume') }}
      </button>
      <div class="battle__row">
        <button
          class="button button--wide"
          :class="{ 'button--on': settings.logOpen }"
          type="button"
          data-test="menu-log"
          :aria-pressed="settings.logOpen"
          @click="settings.logOpen = !settings.logOpen"
        >
          {{ t('hud.log') }}
        </button>
        <button
          class="button button--wide"
          :class="{ 'button--on': store.terrainShown }"
          type="button"
          data-test="menu-terrain"
          :aria-pressed="store.terrainShown"
          @click="store.toggleTerrain()"
        >
          {{ t('hud.terrain') }}
        </button>
      </div>
      <button class="button button--wide" type="button" @click="overlay = 'settings'">
        {{ t('menu.settings') }}
      </button>
      <button class="button button--wide" type="button" @click="overlay = 'help'">
        {{ t('menu.help') }}
      </button>
      <button class="button button--wide" type="button" data-test="save-file" @click="saveToFile">
        {{ t('menu.saveFile') }}
      </button>
      <button class="button button--wide" type="button" data-test="restart" @click="restart">
        {{ t('menu.restart') }}
      </button>
      <button
        class="button button--wide"
        type="button"
        data-test="main-menu"
        @click="emit('mainMenu')"
      >
        {{ t('menu.mainMenu') }}
      </button>
    </GameDialog>

    <GameDialog v-else-if="overlay === 'settings'" :title="t('settings.title')">
      <SettingsPanel />
      <button class="button" type="button" @click="overlay = 'pause'">{{ t('menu.back') }}</button>
    </GameDialog>

    <GameDialog v-else-if="overlay === 'help'" :title="t('help.title')" wide>
      <RulesHelp />
      <button class="button" type="button" @click="overlay = null">{{ t('menu.resume') }}</button>
    </GameDialog>

    <GameDialog
      v-else-if="showResult && result"
      class="battle__result"
      :title="result.title"
      data-test="result"
    >
      <p class="battle__text battle__side" :style="{ borderColor: result.color }">
        {{ result.text }}
      </p>
      <p class="battle__text muted">
        {{
          t('result.rounds', {
            rounds: store.state?.turn ?? 0,
            word: plural('rounds', store.state?.turn ?? 0),
          })
        }}
      </p>
      <table class="summary" data-test="summary">
        <thead>
          <tr>
            <th />
            <th>{{ t('result.standing') }}</th>
            <th>{{ t('result.dead') }}</th>
            <th>{{ t('result.fled') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="side in summary" :key="side.player">
            <th scope="row">
              <span class="summary__dot" :style="{ background: side.color }" />
              {{ side.name }}
            </th>
            <td>{{ side.standing }} / {{ side.total }}</td>
            <td>{{ side.dead }}</td>
            <td>{{ side.fled }}</td>
          </tr>
        </tbody>
      </table>
      <button class="button button--primary button--wide" type="button" @click="restart">
        {{ t('menu.restart') }}
      </button>
      <button class="button button--wide" type="button" @click="resultDismissed = true">
        {{ t('menu.resume') }}
      </button>
      <button class="button button--wide" type="button" @click="emit('mainMenu')">
        {{ t('menu.mainMenu') }}
      </button>
    </GameDialog>
  </main>
</template>

<style scoped>
.battle {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.battle__rejection {
  position: absolute;
  top: 84px;
  z-index: 6;
  left: 50%;
  margin: 0;
  border-color: var(--danger);
  transform: translateX(-50%);
}

.battle__text {
  margin: 0;
}

.battle__side {
  padding-left: 8px;
  border-left: 3px solid;
}

/* Nothing of the battle may show through while the players change seats. */
.battle__handover {
  background: var(--bg);
}

.battle__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.summary {
  border-collapse: collapse;
  font-size: 13px;
}

.summary th,
.summary td {
  padding: 4px 8px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
  text-align: center;
  font-weight: normal;
}

.summary thead th {
  color: var(--muted);
}

.summary tbody th {
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
}

.summary__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

@media (max-width: 900px), (max-height: 560px) {
  .battle__rejection {
    top: 64px;
    max-width: calc(100% - 120px);
  }
}

/* The last blows are still being played out when the battle is decided. */
.battle__result {
  animation: result-in 0.4s 1.2s both;
}

@keyframes result-in {
  from {
    opacity: 0;
  }
}
</style>
