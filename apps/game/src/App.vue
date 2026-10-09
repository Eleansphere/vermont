<script setup lang="ts">
import { computed } from 'vue';
import { FACTIONS, RULES_VERSION } from '@vermont/core';
import type { PlayerSlot } from '@vermont/core';
import BattleCanvas from './components/BattleCanvas.vue';
import { useBattleStore } from './stores/battle';

const store = useBattleStore();
if (!store.state) store.start(Date.now());

function sideName(player: PlayerSlot): string {
  const factionId = store.scenario?.sides[player].factionId;
  return (factionId && FACTIONS[factionId]?.name) || `Hráč ${player + 1}`;
}

const status = computed(() => {
  const battle = store.state;
  if (!battle) return '';
  if (battle.winner) return `Zvítězil ${sideName(battle.winner.player)}`;
  return `Kolo ${battle.turn} · na tahu ${sideName(battle.activePlayer)}`;
});
</script>

<template>
  <main class="game">
    <BattleCanvas />
    <!-- A stand-in until the real interface: just enough to play turns and see the renderer. -->
    <header class="game__bar">
      <span class="game__status">{{ status }}</span>
      <button
        class="game__end-turn"
        type="button"
        :disabled="store.state?.phase !== 'battle'"
        @click="store.endTurn()"
      >
        Ukončit tah
      </button>
    </header>
    <footer class="game__version">
      Vermont · pravidla v{{ RULES_VERSION }} · tažením posun, kolečkem zoom, Q/E otočení
    </footer>
  </main>
</template>

<style scoped>
.game {
  position: relative;
  height: 100%;
}

.game__bar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(27 31 39 / 80%);
}

.game__end-turn {
  padding: 4px 10px;
  border: 1px solid #55607a;
  border-radius: 6px;
  background: #2a3140;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.game__end-turn:disabled {
  opacity: 0.5;
  cursor: default;
}

.game__version {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 12px;
  opacity: 0.6;
  pointer-events: none;
}
</style>
