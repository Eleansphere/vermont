<script setup lang="ts">
import { computed } from 'vue';
import { unitTypeOf } from '@vermont/core';
import { formatNumber } from '../battle/format';
import { sideColor, unitLabel } from '../battle/labels';
import { abilityText, archetypeName, moraleStateName, t } from '../i18n';
import { useBattleStore } from '../stores/battle';

const store = useBattleStore();

const view = computed(() => {
  const { state, defs, selectedUnit: unit } = store;
  if (!state || !defs || !unit) return null;
  const type = unitTypeOf(defs, unit);
  return {
    unit,
    type,
    label: unitLabel(state, defs, unit),
    color: sideColor(unit.owner),
    inReserve: unit.status === 'reserve',
    stats: [
      { key: 'attack', label: t('unit.attack'), value: formatNumber(type.attack) },
      { key: 'defense', label: t('unit.defense'), value: formatNumber(type.defense) },
      ...(type.range === undefined
        ? []
        : [{ key: 'range', label: t('unit.range'), value: formatNumber(type.range) }]),
      { key: 'sight', label: t('unit.sight'), value: formatNumber(type.sight) },
    ],
    bars: [
      { key: 'hp', label: t('unit.hp'), value: unit.hp, max: type.hp },
      { key: 'morale', label: t('unit.morale'), value: unit.morale, max: defs.rules.morale.max },
      { key: 'movement', label: t('unit.movement'), value: unit.movementLeft, max: type.movement },
    ],
    abilities: type.abilities.map((id) => ({
      id,
      ...abilityText(id),
      spent: unit.spentAbilities.includes(id),
    })),
    hasRelief: state.phase === 'battle' && type.abilities.includes('lineRelief'),
  };
});

function share(value: number, max: number): string {
  return `${Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100}%`;
}
</script>

<template>
  <aside v-if="view" class="unit panel" data-test="unit-panel">
    <header class="unit__header" :style="{ borderColor: view.color }">
      <h3 class="unit__name">{{ view.label }}</h3>
      <span class="muted">{{ archetypeName(view.type.archetype) }}</span>
    </header>

    <p v-if="view.inReserve" class="unit__state muted">{{ t('unit.inReserve') }}</p>
    <p v-else class="unit__state">
      <span :class="`unit__morale unit__morale--${view.unit.moraleState}`">
        {{ moraleStateName(view.unit.moraleState) }}
      </span>
      <span class="muted">
        · {{ t(view.unit.hasAttacked ? 'unit.hasAttacked' : 'unit.canAttack') }}
      </span>
    </p>

    <dl class="unit__bars">
      <div v-for="bar in view.bars" :key="bar.key" class="bar" :data-test="`bar-${bar.key}`">
        <dt>{{ bar.label }}</dt>
        <dd>
          <span class="bar__track">
            <span
              class="bar__fill"
              :class="`bar__fill--${bar.key}`"
              :style="{ width: share(bar.value, bar.max) }"
            />
          </span>
          <span class="bar__value">{{ formatNumber(bar.value) }}/{{ formatNumber(bar.max) }}</span>
        </dd>
      </div>
    </dl>

    <dl class="unit__stats">
      <div v-for="stat in view.stats" :key="stat.key" class="stat">
        <dt class="muted">{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>

    <ul v-if="view.abilities.length > 0" class="unit__abilities">
      <li v-for="ability in view.abilities" :key="ability.id" :title="ability.description">
        <strong :class="{ 'unit__ability--spent': ability.spent }">{{ ability.name }}</strong>
        <span v-if="ability.spent" class="muted"> ({{ t('unit.spent') }})</span>
        <span class="unit__ability-text muted">{{ ability.description }}</span>
      </li>
    </ul>

    <template v-if="view.hasRelief">
      <button
        class="button button--wide"
        :class="{ 'button--primary': store.order === 'relief' }"
        type="button"
        data-test="relief"
        :disabled="store.reliefPartners.length === 0"
        @click="store.toggleRelief()"
      >
        {{ t(store.order === 'relief' ? 'unit.reliefCancel' : 'unit.relief') }} <kbd>R</kbd>
      </button>
      <p v-if="store.order === 'relief'" class="unit__hint muted">{{ t('unit.reliefHint') }}</p>
    </template>
  </aside>
</template>

<style scoped>
.unit {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 250px;
}

.unit__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 2px solid;
}

.unit__name {
  font-size: 18px;
}

.unit__state,
.unit__hint {
  margin: 0;
}

.unit__morale--shaken {
  color: var(--accent);
}

.unit__morale--routing {
  color: var(--danger);
}

.unit__bars,
.unit__stats {
  margin: 0;
}

.unit__bars {
  display: grid;
  gap: 4px;
}

.bar {
  display: grid;
  grid-template-columns: 64px 1fr;
  align-items: center;
}

.bar dd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.bar__track {
  flex: 1;
  height: 7px;
  border-radius: 4px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
}

.bar__fill {
  display: block;
  height: 100%;
}

.bar__fill--hp {
  background: var(--good);
}

.bar__fill--morale {
  background: var(--accent);
}

.bar__fill--movement {
  background: #6fa3d8;
}

.bar__value {
  min-width: 44px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.unit__stats {
  display: flex;
  gap: 14px;
}

.stat dt {
  font-size: 12px;
}

.stat dd {
  margin: 0;
  font-size: 16px;
}

.unit__abilities {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.unit__ability--spent {
  text-decoration: line-through;
}

.unit__ability-text {
  display: block;
  font-size: 12px;
}
</style>
