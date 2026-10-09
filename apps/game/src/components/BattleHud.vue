<script setup lang="ts">
import { computed } from 'vue';
import { PLAYER_SLOTS } from '@vermont/core';
import { armyStatus, sideColor, sideName } from '../battle/labels';
import { t } from '../i18n';
import { useBattleStore } from '../stores/battle';

defineEmits<{ endTurn: []; menu: [] }>();

const store = useBattleStore();

const armies = computed(() => {
  const { state, defs, scenario } = store;
  if (!state || !defs || !scenario) return [];
  return PLAYER_SLOTS.map((player) => ({
    player,
    name: sideName(scenario, player),
    color: sideColor(player),
    active: state.phase !== 'ended' && state.activePlayer === player,
    status: armyStatus(state, defs, player),
  }));
});

const phaseText = computed(() => {
  const battle = store.state;
  if (!battle) return '';
  return battle.phase === 'deployment'
    ? t('hud.deployment')
    : t('hud.round', { turn: battle.turn });
});

const activeSide = computed(() => {
  const battle = store.state;
  if (!battle || !store.scenario || battle.phase === 'ended') return null;
  return {
    name: sideName(store.scenario, battle.activePlayer),
    color: sideColor(battle.activePlayer),
  };
});

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}
</script>

<template>
  <header class="hud">
    <div class="hud__armies panel">
      <div
        v-for="army in armies"
        :key="army.player"
        class="army"
        :class="{ 'army--active': army.active }"
        :data-test="`army-${army.player}`"
      >
        <span class="army__name">
          <span class="army__dot" :style="{ background: army.color }" />
          {{ army.name }}
        </span>
        <span class="army__count muted">
          {{ t('hud.army.fighting', { count: army.status.fighting, total: army.status.total })
          }}<template v-if="army.status.routing > 0"
            >, {{ t('hud.army.routing', { count: army.status.routing }) }}</template
          >
        </span>
        <span
          class="army__bar"
          :title="`${t('hud.army.strength')} ${percent(army.status.strength)}`"
        >
          <span
            class="army__fill"
            :style="{ width: percent(army.status.strength), background: army.color }"
          />
        </span>
      </div>
    </div>

    <div class="hud__turn panel" data-test="turn">
      <span class="hud__phase">{{ phaseText }}</span>
      <template v-if="activeSide">
        <span class="muted">{{ t('hud.onTurn') }}</span>
        <strong class="hud__side" :style="{ borderColor: activeSide.color }">
          {{ activeSide.name }}
        </strong>
      </template>
    </div>

    <div class="hud__actions panel">
      <button
        class="button"
        type="button"
        data-test="undo"
        :disabled="!store.canUndo"
        @click="store.undo()"
      >
        {{ t('hud.undo') }}
      </button>
      <button
        v-if="store.state?.phase !== 'deployment'"
        class="button button--primary"
        type="button"
        data-test="end-turn"
        :disabled="store.state?.phase !== 'battle'"
        @click="$emit('endTurn')"
      >
        {{ t('hud.endTurn') }}
        <span v-if="store.readyUnits.length > 0" class="hud__ready">
          {{ store.readyUnits.length }}
        </span>
      </button>
      <button class="button" type="button" data-test="menu" @click="$emit('menu')">
        {{ t('hud.menu') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 10px;
  right: 10px;
  left: 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  pointer-events: none;
}

.hud > * {
  pointer-events: auto;
}

.hud__armies {
  display: flex;
  gap: 16px;
}

.army {
  display: grid;
  gap: 3px;
  min-width: 150px;
  opacity: 0.7;
}

.army--active {
  opacity: 1;
}

.army__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: 16px;
}

.army__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.army__count {
  font-size: 12px;
}

.army__bar {
  height: 5px;
  border-radius: 3px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
}

.army__fill {
  display: block;
  height: 100%;
  transition: width 0.3s;
}

.hud__turn {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hud__phase {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--accent);
}

.hud__side {
  border-bottom: 2px solid;
}

.hud__actions {
  display: flex;
  gap: 8px;
}

.hud__ready {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 8px;
  background: rgb(0 0 0 / 35%);
  font-size: 12px;
}
</style>
