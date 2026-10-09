<script setup lang="ts">
import { t } from '../i18n';
import { useSettingsStore } from '../stores/settings';

const settings = useSettingsStore();
</script>

<template>
  <div class="settings">
    <label class="settings__option">
      <input v-model="settings.confirmEndTurn" type="checkbox" name="confirmEndTurn" />
      {{ t('settings.confirmEndTurn') }}
    </label>
    <label class="settings__option">
      <input v-model="settings.showLog" type="checkbox" name="showLog" />
      {{ t('settings.showLog') }}
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
</style>
