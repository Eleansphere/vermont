<script setup lang="ts">
import { computed } from 'vue';
import { terrainMoveCost, unitTypeOf } from '@vermont/core';
import { formatNumber, formatSigned } from '../battle/format';
import { sideColor, sideName, unitLabel } from '../battle/labels';
import { moraleStateName, t, terrainName } from '../i18n';
import { useBattleStore } from '../stores/battle';

/** Where the pointer is, in pixels from the corner of the battle screen. */
const props = defineProps<{ x: number; y: number }>();

const store = useBattleStore();

/** How far from the pointer the tooltip sits, so it never covers the hex it describes. */
const OFFSET = 18;

const view = computed(() => {
  const { state, defs, scenario, hoverInfo: info } = store;
  if (!state || !defs || !scenario || !info) return null;

  const { terrain, unit, preview } = info;
  // What the ground costs the selected unit, or anybody when no unit is selected.
  const mover = store.commandedUnit;
  const cost = mover
    ? terrainMoveCost(terrain, unitTypeOf(defs, mover).archetype)
    : terrain.moveCost;
  const facts = [
    cost === null ? t('tip.impassable') : t('tip.moveCost', { cost: formatNumber(cost) }),
    terrain.defenseBonus !== 0 && t('tip.defense', { bonus: formatSigned(terrain.defenseBonus) }),
    terrain.attackBonus && t('tip.attack', { bonus: formatSigned(terrain.attackBonus) }),
    terrain.isHill && t('tip.hill'),
    terrain.blocksSight && t('tip.blocksSight'),
  ].filter((fact): fact is string => typeof fact === 'string');

  return {
    terrain: terrainName(terrain.id),
    facts,
    camp: info.campOf === null ? null : t('tip.camp', { side: sideName(scenario, info.campOf) }),
    unit: unit && {
      label: unitLabel(state, defs, unit),
      color: sideColor(unit.owner),
      hp: `${unit.hp}/${unitTypeOf(defs, unit).hp}`,
      morale: moraleStateName(unit.moraleState),
      moraleState: unit.moraleState,
      attack: unitTypeOf(defs, unit).attack,
      defense: unitTypeOf(defs, unit).defense,
    },
    preview: preview && {
      kind: t(`tip.kind.${preview.kind}`),
      damage: t('tip.damage', { min: preview.damage.min, max: preview.damage.max }),
      counter: preview.counterDamage
        ? t('tip.counter', { min: preview.counterDamage.min, max: preview.counterDamage.max })
        : t('tip.noCounter'),
    },
  };
});

const position = computed(() => ({
  left: `${props.x + OFFSET}px`,
  top: `${props.y + OFFSET}px`,
}));
</script>

<template>
  <div v-if="view" class="tip panel" :style="position" role="tooltip" data-test="tooltip">
    <div class="tip__terrain">
      <strong>{{ view.terrain }}</strong>
      <span class="muted">{{ view.facts.join(' · ') }}</span>
    </div>
    <div v-if="view.camp" class="tip__camp">{{ view.camp }}</div>

    <div v-if="view.unit" class="tip__unit" :style="{ borderColor: view.unit.color }">
      <strong>{{ view.unit.label }}</strong>
      <span>
        {{ t('unit.hp') }} {{ view.unit.hp }} ·
        <span :class="`tip__morale--${view.unit.moraleState}`">{{ view.unit.morale }}</span>
      </span>
      <span class="muted">
        {{ t('unit.attack') }} {{ view.unit.attack }} · {{ t('unit.defense') }}
        {{ view.unit.defense }}
      </span>
    </div>

    <div v-if="view.preview" class="tip__preview" data-test="preview">
      <strong>{{ t('tip.preview') }}</strong> <span class="muted">({{ view.preview.kind }})</span>
      <span>{{ view.preview.damage }}</span>
      <span>{{ view.preview.counter }}</span>
    </div>
  </div>
</template>

<style scoped>
.tip {
  position: absolute;
  z-index: 5;
  display: grid;
  gap: 6px;
  max-width: 260px;
  padding: 8px 10px;
  font-size: 13px;
  pointer-events: none;
}

.tip__terrain,
.tip__unit,
.tip__preview {
  display: grid;
  gap: 1px;
}

.tip__unit {
  padding-left: 6px;
  border-left: 3px solid;
}

.tip__morale--shaken,
.tip__camp {
  color: var(--accent);
}

.tip__morale--routing,
.tip__preview strong {
  color: var(--danger);
}
</style>
