<script setup lang="ts">
import { computed } from 'vue';
import { unitLabel } from '../battle/labels';
import { t } from '../i18n';
import { useBattleStore } from '../stores/battle';

const store = useBattleStore();

const waiting = computed(() => {
  const { state, defs } = store;
  if (!state || !defs) return [];
  return store.reserve.map((unit) => ({ id: unit.id, label: unitLabel(state, defs, unit) }));
});
</script>

<template>
  <aside class="deploy panel" data-test="deployment">
    <h3 class="deploy__title">{{ t('deploy.title') }}</h3>
    <p class="deploy__text muted">{{ t('deploy.hint') }}</p>

    <p class="deploy__text">
      {{
        waiting.length > 0
          ? t('deploy.reserve', { count: waiting.length })
          : t('deploy.allDeployed')
      }}
    </p>
    <ul v-if="waiting.length > 0" class="deploy__list">
      <li v-for="unit in waiting" :key="unit.id">
        <button
          class="button button--wide deploy__unit"
          :class="{ 'button--primary': unit.id === store.selectedUnitId }"
          type="button"
          :data-test="`reserve-${unit.id}`"
          @click="store.select(unit.id)"
        >
          {{ unit.label }}
        </button>
      </li>
    </ul>

    <button
      class="button button--wide"
      type="button"
      data-test="auto-deploy"
      :disabled="waiting.length === 0"
      @click="store.autoDeploy()"
    >
      {{ t('deploy.auto') }}
    </button>
    <button
      class="button button--primary button--wide"
      type="button"
      data-test="end-deployment"
      :disabled="waiting.length > 0"
      @click="store.endDeployment()"
    >
      {{ t('deploy.confirm') }} <kbd>Enter</kbd>
    </button>
  </aside>
</template>

<style scoped>
.deploy {
  position: absolute;
  top: 84px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 250px;
  max-height: calc(100% - 420px);
}

.deploy__title {
  font-size: 18px;
  color: var(--accent);
}

.deploy__text {
  margin: 0;
}

.deploy__list {
  display: grid;
  gap: 4px;
  min-height: 40px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.deploy__unit {
  padding: 3px 10px;
  text-align: left;
}
</style>
