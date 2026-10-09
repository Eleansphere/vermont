<script setup lang="ts">
import { RULES_VERSION } from '@vermont/core';
import BattleCanvas from './components/BattleCanvas.vue';
</script>

<template>
  <main class="game">
    <BattleCanvas />
    <footer class="game__version">Vermont · pravidla v{{ RULES_VERSION }}</footer>
  </main>
</template>

<style scoped>
.game {
  position: relative;
  height: 100%;
}

.game__version {
  position: absolute;
  left: 12px;
  bottom: 8px;
  font-size: 12px;
  opacity: 0.6;
}
</style>
