<script setup lang="ts">
import { ref } from 'vue';
import { RULES_VERSION } from '@vermont/core';
import { saveProblemText, t } from '../i18n';
import type { SaveProblem } from '../save/savedGame';
import SettingsPanel from './SettingsPanel.vue';
import ShortcutList from './ShortcutList.vue';

defineProps<{ canContinue: boolean; saveProblem: SaveProblem | null }>();
const emit = defineEmits<{ newBattle: []; continue: []; loadFile: [file: File] }>();

type Page = 'main' | 'settings' | 'shortcuts';
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
        class="button button--wide"
        :class="{ 'button--primary': !canContinue }"
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
      <button class="button button--wide" type="button" @click="page = 'shortcuts'">
        {{ t('menu.shortcuts') }}
      </button>
    </nav>

    <section v-else class="menu__box panel">
      <h2>{{ t(page === 'settings' ? 'settings.title' : 'keys.title') }}</h2>
      <SettingsPanel v-if="page === 'settings'" />
      <ShortcutList v-else />
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
  gap: 24px;
  height: 100%;
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
</style>
