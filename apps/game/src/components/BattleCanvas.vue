<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue';
import { createBattleScene } from '@vermont/render';
import type { BattleScene } from '@vermont/render';
import { useBattleStore } from '../stores/battle';

const store = useBattleStore();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

// The Three.js scene lives outside Vue reactivity on purpose.
let scene: BattleScene | null = null;
let resizeObserver: ResizeObserver | null = null;

/** A new battle has a new map, so the scene is built again. */
function buildScene(): void {
  scene?.dispose();
  scene = null;
  if (!canvas.value || !store.defs || !store.state) return;

  scene = createBattleScene(canvas.value, {
    defs: store.defs,
    onPick: (pick) => store.pick(pick),
    onHover: (pick) => store.hover(pick?.hex ?? null),
  });
  scene.sync(store.state);
  scene.setHighlights(store.highlights);
}

onMounted(() => {
  if (!canvas.value) return;
  buildScene();
  resizeObserver = new ResizeObserver(() => scene?.resize());
  resizeObserver.observe(canvas.value);
});

watch(() => store.defs, buildScene);
watch(
  () => store.played,
  (played) => {
    if (played) scene?.play(played.events, played.state);
  }
);
watch(
  () => store.highlights,
  (highlights) => scene?.setHighlights(highlights)
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  scene?.dispose();
});
</script>

<template>
  <canvas ref="canvas" class="battle-canvas" />
</template>

<style scoped>
.battle-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
</style>
