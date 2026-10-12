<script setup lang="ts">
import { ref, watch } from 'vue';
import BattleScreen from './components/BattleScreen.vue';
import MainMenu from './components/MainMenu.vue';
import ScenarioSelect from './components/ScenarioSelect.vue';
import type { SaveProblem } from './save/savedGame';
import { SaveError, parseSavedGame } from './save/savedGame';
import { storeSave, storedSave } from './save/storage';
import type { StartOptions } from './stores/battle';
import { useBattleStore } from './stores/battle';

type Screen = 'menu' | 'scenarios' | 'battle';

const store = useBattleStore();
const screen = ref<Screen>('menu');
/** Why the last save the player wanted loaded could not be. */
const saveProblem = ref<SaveProblem | null>(null);

/** Loads the save; returns whether it could be loaded, and tells the player when not. */
function loadSave(json: string): boolean {
  try {
    store.load(parseSavedGame(json));
    saveProblem.value = null;
    return true;
  } catch (error) {
    if (!(error instanceof SaveError)) throw error;
    saveProblem.value = error.problem;
    return false;
  }
}

// The battle left unfinished at the last visit waits behind "continue". One that cannot be
// loaded, such as a save from an older version of the rules, is of no use any more.
const kept = storedSave();
if (kept !== null && !loadSave(kept)) storeSave(null);

// Every order is kept at once, so closing the browser loses nothing. A battle that is over
// has nothing left to continue.
watch(
  () => (store.state?.phase === 'ended' ? null : store.savedGame),
  (saved) => storeSave(saved)
);

function startBattle(scenarioId: string, options: StartOptions): void {
  // The clock is the seed: every battle rolls differently, a saved seed replays it.
  store.start(Date.now(), scenarioId, options);
  saveProblem.value = null;
  screen.value = 'battle';
}

async function loadFile(file: File): Promise<void> {
  if (loadSave(await file.text())) screen.value = 'battle';
}
</script>

<template>
  <MainMenu
    v-if="screen === 'menu'"
    :can-continue="store.state !== null"
    :save-problem="saveProblem"
    @new-battle="screen = 'scenarios'"
    @continue="screen = 'battle'"
    @load-file="loadFile"
  />
  <ScenarioSelect v-else-if="screen === 'scenarios'" @start="startBattle" @back="screen = 'menu'" />
  <BattleScreen v-else @main-menu="screen = 'menu'" />
</template>
