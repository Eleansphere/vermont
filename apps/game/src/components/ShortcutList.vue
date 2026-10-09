<script setup lang="ts">
import type { UiKey } from '../i18n';
import { t } from '../i18n';

const LINES: readonly UiKey[] = [
  'keys.click',
  'keys.drag',
  'keys.rotate',
  'keys.pan',
  'keys.endTurn',
  'keys.undo',
  'keys.next',
  'keys.relief',
  'keys.log',
  'keys.escape',
  'keys.help',
];
</script>

<template>
  <ul class="shortcuts">
    <li v-for="line in LINES" :key="line">{{ t(line) }}</li>
  </ul>
</template>

<style scoped>
.shortcuts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
}
</style>
