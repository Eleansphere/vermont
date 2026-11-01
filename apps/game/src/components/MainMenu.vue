<script setup lang="ts">
import { ref } from 'vue';
import { RULES_VERSION } from '@vermont/core';
import { saveProblemText, t } from '../i18n';
import type { SaveProblem } from '../save/savedGame';
import { useSettingsStore } from '../stores/settings';
import SettingsPanel from './SettingsPanel.vue';
import RulesHelp from './RulesHelp.vue';

defineProps<{ canContinue: boolean; saveProblem: SaveProblem | null }>();
const emit = defineEmits<{
  newBattle: [];
  continue: [];
  training: [];
  loadFile: [file: File];
}>();

const settings = useSettingsStore();

type Page = 'main' | 'settings' | 'help';
const page = ref<Page>('main');
const fileInput = ref<HTMLInputElement | null>(null);

function onFileChosen(): void {
  const input = fileInput.value;
  const file = input?.files?.[0];
  if (!input || !file) return;
  emit('loadFile', file);
  // The same file can be chosen again, for instance after the player has looked at why not.
  input.value = '';
}
</script>

<template>
  <main class="menu">
    <header class="menu__header">
      <h1 class="menu__title">{{ t('app.title') }}</h1>
      <p class="menu__subtitle muted">{{ t('app.subtitle') }}</p>
    </header>

    <nav v-if="page === 'main'" class="menu__box panel">
      <button
        v-if="canContinue"
        class="button button--primary button--wide"
        type="button"
        data-test="continue"
        @click="$emit('continue')"
      >
        {{ t('menu.continue') }}
      </button>
      <button
        v-if="!settings.trainingDone"
        class="button button--wide menu__training"
        :class="{ 'button--primary': !canContinue }"
        type="button"
        data-test="training"
        @click="$emit('training')"
      >
        {{ t('menu.training') }}
        <span class="menu__hint">{{ t('menu.trainingHint') }}</span>
      </button>
      <button
        class="button button--wide"
        :class="{ 'button--primary': !canContinue && settings.trainingDone }"
        type="button"
        data-test="new-battle"
        @click="$emit('newBattle')"
      >
        {{ t('menu.newBattle') }}
      </button>
      <button
        class="button button--wide"
        type="button"
        data-test="load-file"
        @click="fileInput?.click()"
      >
        {{ t('menu.loadFile') }}
      </button>
      <input
        ref="fileInput"
        class="menu__file"
        type="file"
        accept=".json,application/json"
        data-test="save-file"
        @change="onFileChosen"
      />
      <p v-if="saveProblem" class="menu__problem" role="alert" data-test="save-problem">
        {{ saveProblemText(saveProblem) }}
      </p>
      <button
        class="button button--wide"
        type="button"
        data-test="settings"
        @click="page = 'settings'"
      >
        {{ t('menu.settings') }}
      </button>
      <button class="button button--wide" type="button" data-test="help" @click="page = 'help'">
        {{ t('menu.help') }}
      </button>
      <button
        v-if="settings.trainingDone"
        class="button button--wide"
        type="button"
        data-test="training"
        @click="$emit('training')"
      >
        {{ t('menu.training') }}
      </button>
    </nav>

    <section v-else class="menu__box panel" :class="{ 'menu__box--wide': page === 'help' }">
      <h2>{{ t(page === 'settings' ? 'settings.title' : 'help.title') }}</h2>
      <SettingsPanel v-if="page === 'settings'" />
      <RulesHelp v-else />
      <button class="button" type="button" data-test="back" @click="page = 'main'">
        {{ t('menu.back') }}
      </button>
    </section>

    <footer class="menu__version muted">
      {{ t('app.version', { version: RULES_VERSION }) }}
    </footer>
  </main>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Taller than a phone held sideways: the top must stay reachable by scrolling. */
  justify-content: safe center;
  gap: 24px;
  height: 100%;
  padding: 12px 0 28px;
  box-sizing: border-box;
  overflow-y: auto;
  background: radial-gradient(circle at 50% 30%, #2c3140, var(--bg) 70%);
}

.menu__header {
  text-align: center;
}

.menu__title {
  font-size: 64px;
  color: var(--accent);
}

.menu__subtitle {
  margin: 4px 0 0;
}

.menu__box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(360px, calc(100% - 32px));
  padding: 16px;
}

.menu__box--wide {
  width: min(820px, calc(100% - 32px));
}

.menu__training {
  display: grid;
  gap: 2px;
}

.menu__hint {
  font-size: 12px;
  opacity: 0.75;
}

.menu__file {
  display: none;
}

.menu__problem {
  margin: 0;
  color: var(--danger);
  font-size: 14px;
}

.menu__version {
  position: absolute;
  bottom: 10px;
  font-size: 12px;
}

@media (max-height: 560px) {
  .menu {
    gap: 12px;
  }

  .menu__title {
    font-size: 40px;
  }

  .menu__version {
    position: static;
  }
}
</style>
