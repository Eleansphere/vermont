<script setup lang="ts">
import { computed, ref } from 'vue';
import { unitTypeOf } from '@vermont/core';
import { formatNumber } from '../battle/format';
import { sideColor, unitLabel } from '../battle/labels';
import { abilityText, archetypeName, moraleStateName, t } from '../i18n';
import { useBattleStore } from '../stores/battle';
import { useTutorialStore } from '../stores/tutorial';

const store = useBattleStore();
const tutorial = useTutorialStore();
/** On a phone the panel shows only the essentials until the player asks for the rest. */
const expanded = ref(false);

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
    strongAgainst: defs.rules.combat.advantages[type.archetype].map((archetype) =>
      archetypeName(archetype).toLocaleLowerCase('cs')
    ),
    moved: unit.movementLeft < type.movement,
  };
});

function share(value: number, max: number): string {
  return `${Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100}%`;
}
</script>

<template>
  <aside
    v-if="view"
    class="unit panel"
    :class="{ spotlight: tutorial.spot === 'unitPanel', 'unit--expanded': expanded }"
    data-test="unit-panel"
  >
    <header class="unit__header" :style="{ borderColor: view.color }">
      <h3 class="unit__name">{{ view.label }}</h3>
      <span class="muted">{{ archetypeName(view.type.archetype) }}</span>
      <button
        class="unit__more"
        type="button"
        data-test="unit-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ t(expanded ? 'unit.less' : 'unit.more') }}
      </button>
    </header>

    <p v-if="view.inReserve" class="unit__state muted">{{ t('unit.inReserve') }}</p>
    <p v-else class="unit__state">
      <span class="pill" :class="`pill--${view.unit.moraleState}`">
        {{ moraleStateName(view.unit.moraleState) }}
      </span>
      <span class="pill" :class="{ 'pill--done': view.unit.hasAttacked }">
        {{ t(view.unit.hasAttacked ? 'unit.hasAttacked' : 'unit.canAttack') }}
      </span>
      <span v-if="view.moved" class="pill pill--done">{{ t('unit.hasMoved') }}</span>
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

    <dl class="unit__stats unit__detail">
      <div v-for="stat in view.stats" :key="stat.key" class="stat">
        <dt class="muted">{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>

    <p
      v-if="view.strongAgainst.length > 0"
      class="unit__strong unit__detail"
      data-test="strong-against"
    >
      <span class="muted">{{ t('unit.strongAgainst') }}</span>
      {{ view.strongAgainst.join(', ') }}
    </p>

    <ul v-if="view.abilities.length > 0" class="unit__abilities unit__detail">
      <li
        v-for="ability in view.abilities"
        :key="ability.id"
        class="ability"
        :class="{ 'ability--spent': ability.spent }"
        :title="ability.description"
      >
        <strong>{{ ability.name }}</strong>
        <span v-if="ability.spent" class="muted"> ({{ t('unit.spent') }})</span>
        <span class="ability__text muted">{{ ability.description }}</span>
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

.unit__more {
  display: none;
}

@media (max-width: 900px), (max-height: 560px) {
  .unit {
    bottom: calc(8px + env(safe-area-inset-bottom));
    left: calc(8px + env(safe-area-inset-left));
    gap: 5px;
    width: 196px;
    max-height: calc(100% - 140px);
    padding: 6px 8px;
    overflow-y: auto;
    font-size: 12px;
  }

  .unit__name {
    font-size: 15px;
  }

  .unit__more {
    display: block;
    margin-left: auto;
    padding: 2px 6px;
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 11px;
  }

  .unit:not(.unit--expanded) .unit__detail {
    display: none;
  }

  .unit kbd {
    display: none;
  }
}

@media (max-width: 600px) {
  .unit {
    bottom: calc(64px + env(safe-area-inset-bottom));
  }
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
.unit__hint,
.unit__strong {
  margin: 0;
}

.unit__state {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.unit__strong {
  font-size: 13px;
}

.pill {
  padding: 1px 7px;
  border-radius: 9px;
  background: rgb(134 181 108 / 18%);
  color: #b7dc9f;
  font-size: 12px;
}

.pill--done {
  background: rgb(255 255 255 / 8%);
  color: var(--muted);
}

.pill--shaken {
  background: rgb(217 180 90 / 20%);
  color: var(--accent);
}

.pill--routing {
  background: rgb(224 104 90 / 20%);
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
  background: var(--morale);
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

.ability {
  padding: 4px 8px;
  border-left: 2px solid var(--accent);
  border-radius: 3px;
  background: rgb(255 255 255 / 4%);
}

.ability--spent {
  border-left-color: var(--panel-border);
  opacity: 0.6;
}

.ability--spent strong {
  text-decoration: line-through;
}

.ability__text {
  display: block;
  font-size: 12px;
}
</style>
