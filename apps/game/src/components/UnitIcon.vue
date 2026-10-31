<script setup lang="ts">
import type { Archetype } from '@vermont/core';
import { ICON_STROKE, UNIT_ICONS } from '@vermont/render/icons';

/** The sign of a kind of unit, the same as on its plate on the map; drawn in the text colour. */
const props = withDefaults(defineProps<{ archetype: Archetype; pips?: number }>(), { pips: 0 });
</script>

<template>
  <svg class="unit-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      v-for="(path, index) in UNIT_ICONS[props.archetype]"
      :key="index"
      :d="path.d"
      :fill="path.fill ? 'currentColor' : 'none'"
      :stroke="path.fill ? 'none' : 'currentColor'"
      :stroke-width="ICON_STROKE"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
  <span v-if="props.pips > 0" class="unit-icon__pips" aria-hidden="true">
    <span v-for="pip in props.pips" :key="pip" class="unit-icon__pip" />
  </span>
</template>

<style scoped>
.unit-icon {
  display: block;
  width: 1em;
  height: 1em;
}

.unit-icon__pips {
  display: flex;
  justify-content: center;
  gap: 2px;
}

.unit-icon__pip {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
}
</style>
