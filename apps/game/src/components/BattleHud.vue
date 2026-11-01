<script setup lang="ts">
import { computed } from 'vue';
import { PLAYER_SLOTS, holdsEnemyCamp, opponentOf, ordersLeft, ordersPerTurn } from '@vermont/core';
import { armyStatus, campDistance, sideColor, sideName } from '../battle/labels';
import { plural, t } from '../i18n';
import { useBattleStore } from '../stores/battle';
import { useSettingsStore } from '../stores/settings';
import { useTutorialStore } from '../stores/tutorial';

defineEmits<{ endTurn: []; menu: [] }>();

const store = useBattleStore();
const settings = useSettingsStore();
const tutorial = useTutorialStore();

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

/** How far the battle is towards the round limit, 0 to 1; `null` before it starts. */
const roundShare = computed(() => {
  const battle = store.state;
  const limit = store.defs?.rules.roundLimit;
  if (!battle || !limit || battle.phase === 'deployment') return null;
  return Math.min(1, battle.turn / limit);
});

const phaseText = computed(() => {
  const battle = store.state;
  if (!battle) return '';
  return battle.phase === 'deployment'
    ? t('hud.deployment')
    : t('hud.round', { turn: battle.turn, limit: store.defs?.rules.roundLimit ?? battle.turn });
});

const activeSide = computed(() => {
  const battle = store.state;
  if (!battle || !store.scenario || battle.phase === 'ended') return null;
  return {
    name: sideName(store.scenario, battle.activePlayer),
    color: sideColor(battle.activePlayer),
  };
});

/** The goal of the player at the screen: the enemy camp, and how far their nearest unit is. */
const goal = computed(() => {
  const { known, defs, viewer } = store;
  if (!known || !defs || known.phase !== 'battle') return null;
  const distance = campDistance(known, defs, viewer);
  if (distance === null) return null;
  return t('hud.goal', { distance, hexes: plural('hexes', distance) });
});

/** Orders the side on the move has left this turn; `null` when the battle does not limit them. */
const orders = computed(() => {
  const { state, defs } = store;
  if (!state || !defs || state.phase !== 'battle') return null;
  const left = ordersLeft(state, defs);
  const total = ordersPerTurn(state, defs, state.activePlayer);
  if (left === null || total === null) return null;
  return t('hud.orders', { left, total });
});

/** A camp taken but not fallen yet: the side whose camp it is has one turn to win it back. */
const campAlarm = computed(() => {
  const { known, defs, viewer } = store;
  if (!known || !defs || known.phase !== 'battle') return null;
  if (holdsEnemyCamp(known, defs, opponentOf(viewer))) return t('hud.campThreat');
  if (holdsEnemyCamp(known, defs, viewer)) return t('hud.campHeld');
  return null;
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
          <span class="army__strength" data-test="army-strength">
            {{ percent(army.status.strength) }}
          </span>
        </span>
        <span class="army__count muted">
          {{ t('hud.army.fighting', { count: army.status.fighting, total: army.status.total })
          }}<template v-if="army.status.routing > 0"
            >, {{ t('hud.army.routing', { count: army.status.routing }) }}</template
          >,
          <span :title="t('hud.army.untilBreakHint')" data-test="army-break">{{
            t('hud.army.untilBreak', { count: army.status.untilBreak })
          }}</span>
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

    <div
      class="hud__turn panel"
      :style="{ borderTopColor: activeSide?.color ?? 'var(--panel-border)' }"
    >
      <div class="hud__turn-line" data-test="turn">
        <span class="hud__phase">{{ phaseText }}</span>
        <template v-if="activeSide">
          <span class="muted hud__on-turn">{{ t('hud.onTurn') }}</span>
          <strong class="hud__side" :style="{ color: activeSide.color }">
            {{ activeSide.name }}
          </strong>
          <span v-if="store.aiOnTurn" class="hud__thinking muted" data-test="ai-on-turn">
            {{ t('hud.aiOnTurn') }}
          </span>
          <span
            v-if="orders"
            class="hud__orders"
            :class="{ spotlight: tutorial.spot === 'orders' }"
            data-test="orders"
            :title="t('hud.ordersHint')"
            >{{ orders }}</span
          >
        </template>
      </div>
      <span v-if="campAlarm" class="hud__alarm" data-test="camp-alarm">{{ campAlarm }}</span>
      <span v-else-if="goal" class="hud__goal muted" data-test="goal" :title="t('hud.goalHint')">
        {{ goal }}
      </span>
      <span v-if="roundShare !== null" class="hud__rounds" :title="t('hud.roundLimit')">
        <span class="hud__rounds-fill" :style="{ width: percent(roundShare) }" />
      </span>
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
        :class="{ spotlight: tutorial.spot === 'endTurn' }"
        type="button"
        data-test="end-turn"
        :disabled="store.state?.phase !== 'battle' || store.aiOnTurn"
        @click="$emit('endTurn')"
      >
        {{ t('hud.endTurn') }}
        <span v-if="store.readyUnits.length > 0" class="hud__ready">
          {{ store.readyUnits.length }}
        </span>
      </button>
      <button
        class="button hud__extra"
        :class="{ 'button--on': settings.logOpen, spotlight: tutorial.spot === 'log' }"
        type="button"
        data-test="toggle-log"
        :aria-pressed="settings.logOpen"
        :title="t('hud.logHint')"
        @click="settings.logOpen = !settings.logOpen"
      >
        {{ t('hud.log') }}
      </button>
      <button
        class="button hud__extra"
        :class="{ 'button--on': store.terrainShown }"
        type="button"
        data-test="toggle-terrain"
        :aria-pressed="store.terrainShown"
        :title="t('hud.terrainHint')"
        @click="store.toggleTerrain()"
      >
        {{ t('hud.terrain') }}
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

.army__strength {
  margin-left: auto;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
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
  display: grid;
  gap: 6px;
  border-top-width: 3px;
}

.hud__turn-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hud__goal {
  font-size: 12px;
}

.hud__orders {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
}

.hud__alarm {
  font-size: 12px;
  font-weight: 600;
  color: var(--danger);
}

.hud__rounds {
  height: 3px;
  border-radius: 2px;
  background: rgb(255 255 255 / 10%);
  overflow: hidden;
}

.hud__rounds-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  opacity: 0.7;
}

.hud__thinking {
  animation: thinking 1.2s ease-in-out infinite alternate;
}

@keyframes thinking {
  from {
    opacity: 0.4;
  }
}

.hud__phase {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--accent);
}

.hud__side {
  font-size: 15px;
}

.hud__actions {
  display: flex;
  gap: 8px;
}

/* On a phone the bar shrinks; the log and terrain buttons move into the menu. */
@media (max-width: 900px), (max-height: 560px) {
  .hud {
    top: calc(6px + env(safe-area-inset-top));
    right: calc(6px + env(safe-area-inset-right));
    left: calc(6px + env(safe-area-inset-left));
    gap: 6px;
  }

  .hud > .panel {
    padding: 6px 8px;
  }

  .hud__armies {
    gap: 10px;
    min-width: 0;
  }

  .army {
    min-width: 92px;
    gap: 1px;
  }

  .army__name {
    font-size: 14px;
  }

  .army__strength,
  .army__count,
  .hud__goal {
    font-size: 11px;
  }

  .hud__phase {
    font-size: 15px;
  }

  .hud__side {
    font-size: 13px;
  }

  .hud__on-turn,
  .hud__extra {
    display: none;
  }

  .hud__actions {
    gap: 6px;
  }

  .hud__actions .button {
    min-height: 40px;
    padding: 6px 10px;
    touch-action: manipulation;
  }
}

@media (max-width: 600px) {
  .hud {
    flex-wrap: wrap;
  }

  .hud__armies {
    flex: 1 1 100%;
  }

  .army {
    flex: 1;
  }

  .hud__turn {
    flex: 1;
  }
}

.hud__ready {
  margin-left: 4px;
  padding: 0 6px;
  border-radius: 8px;
  background: rgb(0 0 0 / 35%);
  font-size: 12px;
}
</style>
