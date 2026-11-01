<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../i18n';

/** Held across battles of one visit: once put away, the hint does not come back. */
const dismissed = ref(false);
const portraitPhone = ref(false);
let query: MediaQueryList | null = null;

const update = () => (portraitPhone.value = query?.matches ?? false);

onMounted(() => {
  if (typeof window.matchMedia !== 'function') return;
  query = window.matchMedia('(orientation: portrait) and (max-width: 600px) and (pointer: coarse)');
  update();
  query.addEventListener('change', update);
});
onBeforeUnmount(() => query?.removeEventListener('change', update));
</script>

<template>
  <aside v-if="portraitPhone && !dismissed" class="rotate panel" data-test="rotate-hint">
    <span class="rotate__icon" aria-hidden="true">⟳</span>
    <span class="rotate__text">
      <strong>{{ t('rotate.title') }}</strong>
      <span class="muted">{{ t('rotate.text') }}</span>
    </span>
    <button class="button" type="button" @click="dismissed = true">
      {{ t('rotate.dismiss') }}
    </button>
  </aside>
</template>

<style scoped>
.rotate {
  position: absolute;
  top: calc(136px + env(safe-area-inset-top));
  left: 50%;
  z-index: 7;
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 24px);
  max-width: 380px;
  border-color: var(--accent);
  transform: translateX(-50%);
}

.rotate__icon {
  font-size: 26px;
  color: var(--accent);
}

.rotate__text {
  display: grid;
  flex: 1;
  font-size: 13px;
}
</style>
