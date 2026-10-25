<script setup lang="ts">
import { computed } from 'vue';
import type { ScenarioDef } from '@vermont/core';
import { MAPS, PLAYER_SLOTS, hexKey, mapHexes } from '@vermont/core';
// From the palette alone, so the menu does not pull in Three.js.
import { TERRAIN_STYLES } from '@vermont/render/palette';
import { sideColor } from '../battle/labels';

/** The scenario's map seen from above: terrain, the deployment zones and the camps. */
const props = defineProps<{ scenario: ScenarioDef }>();

const SQRT_3 = Math.sqrt(3);
/** Corners of a pointy-top hex of size 1 around its centre. */
const CORNERS = Array.from({ length: 6 }, (_, index) => {
  const angle = (Math.PI / 180) * (60 * index - 30);
  return `${(Math.cos(angle) * 0.96).toFixed(3)},${(Math.sin(angle) * 0.96).toFixed(3)}`;
}).join(' ');

const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const view = computed(() => {
  const map = MAPS[props.scenario.mapId];
  if (!map) return null;
  const zones = new Map<string, string>();
  const camps = new Map<string, string>();
  for (const player of PLAYER_SLOTS) {
    const side = props.scenario.sides[player];
    for (const zoneHex of side.deploymentZone) zones.set(hexKey(zoneHex), sideColor(player));
    camps.set(hexKey(side.camp), sideColor(player));
  }
  const hexes = mapHexes(map).map((target) => {
    const key = hexKey(target);
    const terrain = map.hexes[key]!.terrain;
    return {
      key,
      x: SQRT_3 * (target.q + target.r / 2),
      y: 1.5 * target.r,
      fill: camps.has(key) ? css(TERRAIN_STYLES.camp.color) : css(TERRAIN_STYLES[terrain].color),
      zone: zones.get(key) ?? null,
      camp: camps.get(key) ?? null,
    };
  });
  const xs = hexes.map((hex) => hex.x);
  const ys = hexes.map((hex) => hex.y);
  const minX = Math.min(...xs) - 1;
  const minY = Math.min(...ys) - 1.1;
  return {
    hexes,
    viewBox: `${minX} ${minY} ${Math.max(...xs) + 1 - minX} ${Math.max(...ys) + 1.1 - minY}`,
  };
});
</script>

<template>
  <svg v-if="view" class="preview" :viewBox="view.viewBox" role="img" aria-hidden="true">
    <g v-for="hex in view.hexes" :key="hex.key" :transform="`translate(${hex.x} ${hex.y})`">
      <polygon :points="CORNERS" :fill="hex.fill" />
      <polygon v-if="hex.zone" :points="CORNERS" :fill="hex.zone" fill-opacity="0.35" />
      <circle v-if="hex.camp" r="0.5" :fill="hex.camp" stroke="#15171c" stroke-width="0.15" />
    </g>
  </svg>
</template>

<style scoped>
.preview {
  display: block;
  width: 100%;
  height: auto;
}
</style>
