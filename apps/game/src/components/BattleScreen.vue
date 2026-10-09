<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { sideColor, sideName } from '../battle/labels';
import type { ShortcutAction } from '../battle/shortcuts';
import { shortcutFor } from '../battle/shortcuts';
import { rejectionText, t, victoryReasonText } from '../i18n';
import { useBattleStore } from '../stores/battle';
import { useSettingsStore } from '../stores/settings';
import BattleCanvas from './BattleCanvas.vue';
import BattleHud from './BattleHud.vue';
import DeploymentPanel from './DeploymentPanel.vue';
import EventLog from './EventLog.vue';
import GameDialog from './GameDialog.vue';
import HexTooltip from './HexTooltip.vue';
import SettingsPanel from './SettingsPanel.vue';
import ShortcutList from './ShortcutList.vue';
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

const winner = computed(() => {
  const { state, scenario } = store;
  if (!state?.winner || !scenario) return null;
  return {
    side: sideName(scenario, state.winner.player),
    color: sideColor(state.winner.player),
    reason: victoryReasonText(state.winner.reason),
  };
});
const showResult = computed(
  () => winner.value !== null && !resultDismissed.value && !overlay.value
);

watch(
  () => store.state?.winner,
  () => (resultDismissed.value = false)
);

function requestEndTurn(): void {
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
  toggleLog: () => (settings.showLog = !settings.showLog),
  escape,
  help: () => (overlay.value = 'help'),
};

function onKeyDown(event: KeyboardEvent): void {
  const action = shortcutFor(event);
  if (!action) return;
  if (overlay.value) {
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
  <main class="battle" @pointermove="onPointerMove" @click="onClick">
    <BattleCanvas />

    <BattleHud @end-turn="requestEndTurn" @menu="overlay = 'pause'" />
    <DeploymentPanel v-if="store.state?.phase === 'deployment'" />
    <UnitPanel />
    <EventLog v-if="settings.showLog" />
    <HexTooltip v-if="!overlay" :x="pointer.x" :y="pointer.y" />

    <p v-if="store.rejection" class="battle__rejection panel" role="alert" data-test="rejection">
      {{ rejectionText(store.rejection.code) }}
    </p>

    <GameDialog v-if="overlay === 'confirmEndTurn'" :title="t('hud.endTurn')">
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
      <button class="button button--wide" type="button" @click="overlay = 'settings'">
        {{ t('menu.settings') }}
      </button>
      <button class="button button--wide" type="button" @click="overlay = 'help'">
        {{ t('menu.shortcuts') }}
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

    <GameDialog v-else-if="overlay === 'help'" :title="t('keys.title')">
      <ShortcutList />
      <button class="button" type="button" @click="overlay = null">{{ t('menu.resume') }}</button>
    </GameDialog>

    <GameDialog
      v-else-if="showResult && winner"
      class="battle__result"
      :title="t('victory.title', { side: winner.side })"
      data-test="result"
    >
      <p class="battle__text" :style="{ borderColor: winner.color }">
        {{ t('log.battleEnded', { side: winner.side, reason: winner.reason }) }}
      </p>
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
  left: 50%;
  margin: 0;
  border-color: var(--danger);
  transform: translateX(-50%);
}

.battle__text {
  margin: 0;
}

.battle__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
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
