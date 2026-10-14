<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { createBattleScene } from '@vermont/render';
import type { BattleScene, ModelKit, RenderStats } from '@vermont/render';
import { modelKit } from '../battle/modelKit';
import { t } from '../i18n';
import { useBattleStore } from '../stores/battle';

const STATS_REFRESH_MS = 500;

const store = useBattleStore();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

// The Three.js scene lives outside Vue reactivity on purpose.
let scene: BattleScene | null = null;
let kit: ModelKit | null = null;
let resizeObserver: ResizeObserver | null = null;
let statsTimer: ReturnType<typeof setInterval> | null = null;
const loading = ref(true);
const showStats = ref(false);
const stats = ref<RenderStats | null>(null);

/** A new battle has a new map, so the scene is built again. */
function buildScene(): void {
  scene?.dispose();
  scene = null;
  if (loading.value || !canvas.value || !store.defs || !store.shown) return;

  scene = createBattleScene(canvas.value, {
    defs: store.defs,
    kit: kit ?? undefined,
    onPick: (pick) => store.pick(pick),
    onHover: (pick) => store.hover(pick?.hex ?? null),
  });
  scene.sync(store.shown.state, store.shown.visible);
  scene.setHighlights(store.highlights);
}

function toggleStats(event: KeyboardEvent): void {
  if (event.code !== 'F3') return;
  event.preventDefault();
  showStats.value = !showStats.value;
  if (statsTimer) clearInterval(statsTimer);
  statsTimer = showStats.value
    ? setInterval(() => (stats.value = scene?.stats() ?? null), STATS_REFRESH_MS)
    : null;
}

const count = (value: number) => Math.round(value).toLocaleString('cs-CZ');

onMounted(async () => {
  window.addEventListener('keydown', toggleStats);
  kit = await modelKit();
  loading.value = false;
  if (!canvas.value) return;
  buildScene();
  resizeObserver = new ResizeObserver(() => scene?.resize());
  resizeObserver.observe(canvas.value);
});

watch(() => store.defs, buildScene);
watch(
  () => store.played,
  (played) => {
    if (!played) return;
    if (played.from) scene?.sync(played.from.state, played.from.visible);
    scene?.play(played.events, played.state, played.visible);
  }
);
watch(
  () => store.highlights,
  (highlights) => scene?.setHighlights(highlights)
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', toggleStats);
  if (statsTimer) clearInterval(statsTimer);
  resizeObserver?.disconnect();
  scene?.dispose();
});
</script>

<template>
  <div class="battle-canvas">
    <canvas ref="canvas" class="battle-canvas__surface" />
    <p v-if="loading" class="battle-canvas__loading">{{ t('perf.loading') }}</p>
    <dl v-if="showStats && stats" class="battle-canvas__stats">
      <dt>{{ t('perf.title') }}</dt>
      <dd>{{ t('perf.fps', { fps: count(stats.fps), ms: stats.frameMs.toFixed(1) }) }}</dd>
      <dd>{{ t('perf.drawCalls', { count: count(stats.drawCalls) }) }}</dd>
      <dd>{{ t('perf.triangles', { count: count(stats.triangles) }) }}</dd>
      <dd>
        {{ t('perf.memory', { geometries: stats.geometries, textures: stats.textures }) }}
      </dd>
    </dl>
  </div>
</template>

<style scoped>
.battle-canvas {
  position: relative;
  width: 100%;
  height: 100%;
}

.battle-canvas__surface {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.battle-canvas__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #d8dce4;
}

.battle-canvas__stats {
  position: absolute;
  /* Below the turn buttons in the top right corner. */
  top: 3.5rem;
  right: 0.5rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: rgb(10 12 16 / 75%);
  color: #d8dce4;
  font:
    12px/1.5 ui-monospace,
    monospace;
  pointer-events: none;
}

.battle-canvas__stats dt {
  font-weight: 600;
}

.battle-canvas__stats dd {
  margin: 0;
}
</style>
