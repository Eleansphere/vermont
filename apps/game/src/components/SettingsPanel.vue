<script setup lang="ts">
import type { UiKey } from '../i18n';
import { t } from '../i18n';
import { useSettingsStore } from '../stores/settings';

type VolumeSetting = 'masterVolume' | 'effectsVolume' | 'musicVolume' | 'ambientVolume';

const VOLUMES: readonly VolumeSetting[] = [
  'masterVolume',
  'effectsVolume',
  'musicVolume',
  'ambientVolume',
];

const settings = useSettingsStore();
const label = (volume: VolumeSetting): UiKey => `settings.${volume}`;
</script>

<template>
  <div class="settings">
    <label class="settings__option toggle">
      <input
        v-model="settings.confirmEndTurn"
        class="toggle__input"
        type="checkbox"
        name="confirmEndTurn"
      />
      <span class="toggle__switch" aria-hidden="true" />
      {{ t('settings.confirmEndTurn') }}
    </label>
    <label class="settings__option toggle">
      <input v-model="settings.logOpen" class="toggle__input" type="checkbox" name="logOpen" />
      <span class="toggle__switch" aria-hidden="true" />
      {{ t('settings.logOpen') }}
    </label>
    <label class="settings__option toggle">
      <input
        v-model="settings.followComputer"
        class="toggle__input"
        type="checkbox"
        name="followComputer"
      />
      <span class="toggle__switch" aria-hidden="true" />
      {{ t('settings.followComputer') }}
    </label>

    <h3 class="settings__heading">{{ t('settings.sound') }}</h3>
    <label class="settings__option toggle">
      <input v-model="settings.muted" class="toggle__input" type="checkbox" name="muted" />
      <span class="toggle__switch" aria-hidden="true" />
      {{ t('settings.muted') }}
    </label>
    <label v-for="volume in VOLUMES" :key="volume" class="settings__volume">
      <span>{{ t(label(volume)) }}</span>
      <input
        v-model.number="settings[volume]"
        type="range"
        min="0"
        max="100"
        step="5"
        :name="volume"
        :disabled="settings.muted"
      />
      <span class="settings__value">{{ settings[volume] }} %</span>
    </label>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings__option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.settings__heading {
  margin: 8px 0 0;
  font-size: 1rem;
}

.settings__volume {
  display: grid;
  grid-template-columns: 9rem 1fr 3.5rem;
  align-items: center;
  gap: 8px;
}

.settings__volume input {
  accent-color: var(--accent);
  accent-color: var(--accent);
}

.settings__value {
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
