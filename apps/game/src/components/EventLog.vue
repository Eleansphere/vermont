<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { sideColor } from '../battle/labels';
import type { LogEntry, LogTone } from '../battle/log';
import { t } from '../i18n';
import { useBattleStore } from '../stores/battle';
import { useTutorialStore } from '../stores/tutorial';

const store = useBattleStore();
const tutorial = useTutorialStore();
const list = useTemplateRef<HTMLDivElement>('list');

/** Turns shown open; the older ones fold away, so the log never turns into a wall of text. */
const OPEN_TURNS = 2;

/** A sign in front of each line, so the kind of event shows at a glance. */
const TONE_SIGNS: Readonly<Record<LogTone, string>> = {
  turn: '',
  move: '›',
  combat: '⚔',
  morale: '!',
  loss: '✕',
  result: '★',
};

interface LogGroup {
  /** The line that opens the turn; `null` for the lines before the first one. */
  readonly heading: LogEntry | null;
  readonly entries: readonly LogEntry[];
}

/** The log split by turns: each line of the `turn` tone opens a new group. */
const groups = computed<LogGroup[]>(() => {
  const result: { heading: LogEntry | null; entries: LogEntry[] }[] = [];
  for (const entry of store.log) {
    if (entry.tone === 'turn' || result.length === 0) {
      result.push(
        entry.tone === 'turn'
          ? { heading: entry, entries: [] }
          : { heading: null, entries: [entry] }
      );
    } else {
      result.at(-1)!.entries.push(entry);
    }
  }
  return result;
});

/** Older turns the player opened by hand. */
const opened = ref(new Set<number>());

function isOpen(index: number): boolean {
  return index >= groups.value.length - OPEN_TURNS || opened.value.has(index);
}

function toggle(index: number): void {
  const next = new Set(opened.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  opened.value = next;
}

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
  <aside class="log panel" :class="{ spotlight: tutorial.spot === 'log' }" data-test="log">
    <h3 class="log__title">{{ t('log.title') }}</h3>
    <p v-if="store.log.length === 0" class="log__empty muted">{{ t('log.empty') }}</p>
    <div v-else ref="list" class="log__list" aria-live="polite">
      <section
        v-for="(group, index) in groups"
        :key="index"
        class="log__group"
        :class="{ 'log__group--closed': !isOpen(index) }"
      >
        <button
          v-if="group.heading"
          type="button"
          class="log__heading"
          :style="{ borderColor: markColor(group.heading) }"
          :aria-expanded="isOpen(index)"
          :disabled="group.entries.length === 0"
          @click="toggle(index)"
        >
          <span>{{ group.heading.text }}</span>
          <span v-if="!isOpen(index) && group.entries.length > 0" class="muted">
            {{ t('log.folded', { count: group.entries.length }) }}
          </span>
        </button>
        <ol v-if="isOpen(index) && group.entries.length > 0" class="log__entries">
          <li
            v-for="(entry, entryIndex) in group.entries"
            :key="entryIndex"
            class="log__entry"
            :class="`log__entry--${entry.tone}`"
            :style="{ borderColor: markColor(entry) }"
          >
            <span class="log__sign" aria-hidden="true">{{ TONE_SIGNS[entry.tone] }}</span>
            <span>{{ entry.text }}</span>
          </li>
        </ol>
      </section>
    </div>
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
  width: 310px;
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
  gap: 6px;
  overflow-y: auto;
  font-size: 13px;
}

.log__group {
  display: grid;
  gap: 2px;
}

.log__heading {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px;
  border: 0;
  border-left: 3px solid;
  border-radius: 2px;
  background: rgb(255 255 255 / 5%);
  color: var(--accent);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.log__group--closed .log__heading {
  color: var(--muted);
}

.log__entries {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.log__entry {
  display: grid;
  grid-template-columns: 14px 1fr;
  gap: 4px;
  padding-left: 6px;
  border-left: 3px solid;
}

.log__sign {
  color: var(--muted);
  text-align: center;
}

.log__entry--move {
  color: var(--muted);
}

.log__entry--combat .log__sign {
  color: var(--text);
}

.log__entry--morale .log__sign {
  color: var(--accent);
}

.log__entry--loss,
.log__entry--loss .log__sign {
  color: var(--danger);
}

.log__entry--result {
  font-weight: bold;
}

.log__entry--result .log__sign {
  color: var(--accent);
}
</style>
