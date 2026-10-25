<script setup lang="ts">
import { t } from '../i18n';
import { useTutorialStore } from '../stores/tutorial';

defineEmits<{ mainMenu: [] }>();

const tutorial = useTutorialStore();
</script>

<template>
  <aside v-if="tutorial.step" class="coach panel" data-test="coach" aria-live="polite">
    <header class="coach__header">
      <h3 class="coach__title">{{ t('tutorial.title') }}</h3>
      <span class="muted">
        {{ t('tutorial.progress', { step: tutorial.stepIndex + 1, count: tutorial.stepCount }) }}
      </span>
    </header>
    <span class="coach__track">
      <span
        class="coach__fill"
        :style="{ width: `${((tutorial.stepIndex + 1) / tutorial.stepCount) * 100}%` }"
      />
    </span>
    <p class="coach__text" :data-test="`coach-${tutorial.step.id}`">{{ t(tutorial.step.text) }}</p>
    <div class="coach__row">
      <button class="coach__skip" type="button" data-test="coach-skip" @click="tutorial.skip()">
        {{ t('tutorial.skip') }}
      </button>
      <button
        v-if="tutorial.step.done === 'next'"
        class="button button--primary"
        type="button"
        data-test="coach-next"
        @click="tutorial.next()"
      >
        {{ t('tutorial.next') }}
      </button>
    </div>
  </aside>

  <aside v-else-if="tutorial.finished" class="coach panel" data-test="coach-done">
    <h3 class="coach__title">{{ t('tutorial.title') }}</h3>
    <p class="coach__text">{{ t('tutorial.done') }}</p>
    <button class="button button--primary" type="button" @click="$emit('mainMenu')">
      {{ t('tutorial.toMenu') }}
    </button>
  </aside>
</template>

<style scoped>
.coach {
  position: absolute;
  top: 92px;
  left: 10px;
  z-index: 4;
  display: grid;
  gap: 8px;
  width: 320px;
  border-color: var(--accent);
  animation: coach-in 0.3s ease-out;
}

@keyframes coach-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.coach__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.coach__title {
  font-size: 17px;
  color: var(--accent);
}

.coach__track {
  height: 3px;
  border-radius: 2px;
  background: rgb(255 255 255 / 10%);
  overflow: hidden;
}

.coach__fill {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

.coach__text {
  margin: 0;
  line-height: 1.5;
}

.coach__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.coach__skip {
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
