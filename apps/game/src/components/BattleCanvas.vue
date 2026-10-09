<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { createBattleScene } from '@vermont/render';
import type { BattleScene } from '@vermont/render';

const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

// The Three.js scene lives outside Vue reactivity on purpose.
let scene: BattleScene | null = null;
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!canvas.value) return;
  scene = createBattleScene(canvas.value);
  resizeObserver = new ResizeObserver(() => scene?.resize());
  resizeObserver.observe(canvas.value);
});

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
}
</style>
