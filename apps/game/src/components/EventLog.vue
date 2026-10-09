<script setup lang="ts">
import { nextTick, useTemplateRef, watch } from 'vue';
import { sideColor } from '../battle/labels';
import type { LogEntry } from '../battle/log';
import { t } from '../i18n';
import { useBattleStore } from '../stores/battle';

const store = useBattleStore();
const list = useTemplateRef<HTMLOListElement>('list');

function markColor(entry: LogEntry): string {
  return entry.player === null ? 'transparent' : sideColor(entry.player);
}

// The newest line is the one the player wants to see.
watch(
  () => store.log.length,
  async () => {
    await nextTick();
    if (list.value) list.value.scrollTop = list.value.scrollHeight;
  },
  { immediate: true }
);
</script>

<template>
  <aside class="log panel" data-test="log">
    <h3 class="log__title">{{ t('log.title') }}</h3>
    <p v-if="store.log.length === 0" class="log__empty muted">{{ t('log.empty') }}</p>
    <ol v-else ref="list" class="log__list" aria-live="polite">
      <li
        v-for="(entry, index) in store.log"
        :key="index"
        class="log__entry"
        :class="`log__entry--${entry.tone}`"
        :style="{ borderColor: markColor(entry) }"
      >
        {{ entry.text }}
      </li>
    </ol>
  </aside>
</template>

<style scoped>
.log {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 300px;
  max-height: 34%;
}

.log__title {
  font-size: 16px;
  color: var(--accent);
}

.log__empty {
  margin: 0;
}

.log__list {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  font-size: 13px;
}

.log__entry {
  padding-left: 6px;
  border-left: 3px solid;
}

.log__entry--turn {
  margin-top: 4px;
  color: var(--accent);
}

.log__entry--move {
  color: var(--muted);
}

.log__entry--loss {
  color: var(--danger);
}

.log__entry--result {
  font-weight: bold;
}
</style>
