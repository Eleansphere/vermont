import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { GraphicsQuality } from '@vermont/render';

/** What the player can set; kept in the browser between visits. */
export interface Settings {
  /** Ask before ending a turn in which some units could still act. */
  confirmEndTurn: boolean;
  /** The event log is open beside the map; closed, the turn summary tells what happened. */
  logOpen: boolean;
  /** The camera follows what the computer does on its turn. */
  followComputer: boolean;
  /** Volumes from 0 to 100; every other volume is a share of the master one. */
  masterVolume: number;
  effectsVolume: number;
  musicVolume: number;
  ambientVolume: number;
  /** Silences everything without losing the volumes. */
  muted: boolean;
  /** The player went through the training to its end; the menu stops offering it first. */
  trainingDone: boolean;
  /** How finely the battle is drawn; `auto` picks by the device. */
  quality: QualitySetting;
}

export type QualitySetting = 'auto' | GraphicsQuality;
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'high', 'medium', 'low'];

export const SETTINGS_STORAGE_KEY = 'vermont.settings';

const DEFAULTS: Readonly<Settings> = {
  confirmEndTurn: true,
  logOpen: false,
  followComputer: true,
  masterVolume: 100,
  effectsVolume: 80,
  musicVolume: 50,
  ambientVolume: 60,
  muted: false,
  trainingDone: false,
  quality: 'auto',
};

const MAX_VOLUME = 100;

/** Saved settings; anything missing or of the wrong type falls back to the default. */
function loadSettings(): Settings {
  const settings: Record<string, unknown> = { ...DEFAULTS };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    if (typeof saved !== 'object' || saved === null) return { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      const value = (saved as Record<string, unknown>)[key];
      if (typeof value !== typeof DEFAULTS[key]) continue;
      if (key === 'quality' && !QUALITY_SETTINGS.includes(value as QualitySetting)) continue;
      settings[key] = typeof value === 'number' ? Math.min(MAX_VOLUME, Math.max(0, value)) : value;
    }
  } catch {
    // Storage that is unavailable or holds something unreadable just means the defaults.
  }
  return settings as unknown as Settings;
}

export const useSettingsStore = defineStore('settings', () => {
  const loaded = loadSettings();
  const confirmEndTurn = ref(loaded.confirmEndTurn);
  const logOpen = ref(loaded.logOpen);
  const followComputer = ref(loaded.followComputer);
  const masterVolume = ref(loaded.masterVolume);
  const effectsVolume = ref(loaded.effectsVolume);
  const musicVolume = ref(loaded.musicVolume);
  const ambientVolume = ref(loaded.ambientVolume);
  const muted = ref(loaded.muted);
  const trainingDone = ref(loaded.trainingDone);
  const quality = ref<QualitySetting>(loaded.quality);

  const current = (): Settings => ({
    confirmEndTurn: confirmEndTurn.value,
    logOpen: logOpen.value,
    followComputer: followComputer.value,
    masterVolume: masterVolume.value,
    effectsVolume: effectsVolume.value,
    musicVolume: musicVolume.value,
    ambientVolume: ambientVolume.value,
    muted: muted.value,
    trainingDone: trainingDone.value,
    quality: quality.value,
  });

  watch(current, (settings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // The settings still hold for this visit.
    }
  });

  return {
    confirmEndTurn,
    logOpen,
    followComputer,
    masterVolume,
    effectsVolume,
    musicVolume,
    ambientVolume,
    muted,
    trainingDone,
    quality,
  };
});
