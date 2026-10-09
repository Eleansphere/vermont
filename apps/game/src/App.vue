<script setup lang="ts">
import { ref } from 'vue';
import BattleScreen from './components/BattleScreen.vue';
import MainMenu from './components/MainMenu.vue';
import ScenarioSelect from './components/ScenarioSelect.vue';
import type { DeploymentMode } from './stores/battle';
import { useBattleStore } from './stores/battle';

type Screen = 'menu' | 'scenarios' | 'battle';

const store = useBattleStore();
const screen = ref<Screen>('menu');

function startBattle(scenarioId: string, deployment: DeploymentMode): void {
  // The clock is the seed: every battle rolls differently, a saved seed replays it.
  store.start(Date.now(), scenarioId, { deployment });
  screen.value = 'battle';
}
</script>

<template>
  <MainMenu
    v-if="screen === 'menu'"
    :can-continue="store.state !== null"
    @new-battle="screen = 'scenarios'"
    @continue="screen = 'battle'"
  />
  <ScenarioSelect v-else-if="screen === 'scenarios'" @start="startBattle" @back="screen = 'menu'" />
  <BattleScreen v-else @main-menu="screen = 'menu'" />
</template>
