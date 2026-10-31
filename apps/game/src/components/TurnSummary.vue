<script setup lang="ts">
import { computed, ref } from 'vue';
import { opponentOf } from '@vermont/core';
import { sideColor, sideName } from '../battle/labels';
import type { LogEntry, UnitDigest } from '../battle/log';
import { lastTurnSummary } from '../battle/log';
import { plural, t } from '../i18n';
import { useBattleStore } from '../stores/battle';

const store = useBattleStore();

/** Lines shown at most; the log has the rest. */
const MAX_LINES = 8;

/** The opening line of the summary the player closed, so it does not come back. */
const dismissed = ref<LogEntry | null>(null);

/** What the other side did in its turn, shown once the player's own turn begins. */
const summary = computed(() => {
  const { known, scenario, viewer } = store;
  if (!known || !scenario || known.phase !== 'battle') return null;
  if (store.aiOnTurn || store.handover !== null || known.activePlayer !== viewer) return null;
  const opponent = opponentOf(viewer);
  const found = lastTurnSummary(store.log, opponent);
  if (!found || found.opening === dismissed.value) return null;
  return {
    ...found,
    shown: found.units.slice(0, MAX_LINES),
    more: Math.max(0, found.units.length - MAX_LINES),
    title: t('summary.title', {
      side: sideName(scenario, opponent),
      turn: found.opening.turn ?? 0,
    }),
    color: sideColor(opponent),
  };
});

function show(unit: UnitDigest): void {
  if (unit.hex) store.focus(unit.hex);
}

/** The unit's line: its name, the damage it took and what became of it. */
function describe(unit: UnitDigest): string {
  return [
    unit.damage > 0
      ? t('summary.damage', { damage: unit.damage, lives: plural('lives', unit.damage) })
      : null,
    unit.outcome ? t(`summary.outcome.${unit.outcome}`) : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function gone(unit: UnitDigest): boolean {
  return unit.outcome === 'died' || unit.outcome === 'fled';
}
</script>

<template>
  <aside
    v-if="summary"
    class="summary panel"
    :style="{ borderTopColor: summary.color }"
    aria-live="polite"
    data-test="turn-summary"
  >
    <header class="summary__header">
      <h3 class="summary__title">{{ summary.title }}</h3>
      <button
        type="button"
        class="summary__close"
        :aria-label="t('summary.close')"
        data-test="turn-summary-close"
        @click="dismissed = summary.opening"
      >
        ×
      </button>
    </header>
    <ol v-if="summary.shown.length > 0" class="summary__lines">
      <li v-for="unit in summary.shown" :key="unit.unitId">
        <button
          type="button"
          class="summary__line"
          :class="{ 'summary__line--gone': gone(unit) }"
          :style="{ borderColor: sideColor(unit.player) }"
          :disabled="!unit.hex"
          :data-test="`summary-${unit.unitId}`"
          @click="show(unit)"
        >
          <strong>{{ unit.label }}</strong>
          <span>{{ describe(unit) }}</span>
        </button>
      </li>
    </ol>
    <p v-if="summary.more > 0" class="summary__note muted">
      {{ t('summary.more', { count: summary.more }) }}
    </p>
    <p v-if="summary.moves > 0" class="summary__note muted">
      {{ t('summary.moves', { count: summary.moves, units: plural('units', summary.moves) }) }}
    </p>
    <p v-if="summary.shown.some((unit) => unit.hex)" class="summary__note muted">
      {{ t('summary.hint') }}
    </p>
  </aside>
</template>

<style scoped>
.summary {
  position: absolute;
  top: 74px;
  right: 10px;
  z-index: 3;
  display: grid;
  gap: 6px;
  width: 340px;
  border-top: 3px solid;
  animation: summary-in 0.3s ease-out;
}

@keyframes summary-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.summary__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.summary__title {
  font-size: 16px;
  color: var(--accent);
}

.summary__close {
  padding: 0 6px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.summary__close:hover {
  color: var(--text);
}

.summary__lines {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary__line {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 2px 6px;
  border: 0;
  border-left: 3px solid;
  border-radius: 2px;
  background: rgb(255 255 255 / 4%);
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.summary__line:disabled {
  cursor: default;
}

.summary__line:not(:disabled):hover {
  background: rgb(255 255 255 / 10%);
}

.summary__line strong {
  font-weight: 600;
}

.summary__line--gone {
  color: var(--danger);
}

.summary__note {
  margin: 0;
  font-size: 12px;
}
</style>
