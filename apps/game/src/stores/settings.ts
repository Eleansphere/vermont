import { ref, watch } from 'vue';
import { defineStore } from 'pinia';

/** What the player can set; kept in the browser between visits. */
export interface Settings {
  /** Ask before ending a turn in which some units could still act. */
  confirmEndTurn: boolean;
  showLog: boolean;
}

export const SETTINGS_STORAGE_KEY = 'vermont.settings';

const DEFAULTS: Readonly<Settings> = { confirmEndTurn: true, showLog: true };

/** Saved settings; anything missing or of the wrong type falls back to the default. */
function loadSettings(): Settings {
  const settings = { ...DEFAULTS };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    if (typeof saved !== 'object' || saved === null) return settings;
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value === 'boolean') settings[key] = value;
    }
  } catch {
    // Storage that is unavailable or holds something unreadable just means the defaults.
  }
  return settings;
}

export const useSettingsStore = defineStore('settings', () => {
  const loaded = loadSettings();
  const confirmEndTurn = ref(loaded.confirmEndTurn);
  const showLog = ref(loaded.showLog);

  watch([confirmEndTurn, showLog], () => {
    const settings: Settings = { confirmEndTurn: confirmEndTurn.value, showLog: showLog.value };
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // The settings still hold for this visit.
    }
  });

  return { confirmEndTurn, showLog };
});
