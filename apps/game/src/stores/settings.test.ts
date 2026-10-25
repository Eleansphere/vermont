import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { SETTINGS_STORAGE_KEY, useSettingsStore } from './settings';

describe('settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts with the defaults', () => {
    const settings = useSettingsStore();

    expect(settings.confirmEndTurn).toBe(true);
    expect(settings.showLog).toBe(true);
    expect(settings.effectsVolume).toBe(80);
    expect(settings.musicVolume).toBe(50);
    expect(settings.ambientVolume).toBe(60);
    expect(settings.muted).toBe(false);
  });

  it('keeps a change for the next visit', async () => {
    useSettingsStore().showLog = false;
    await nextTick();

    setActivePinia(createPinia());

    expect(useSettingsStore().showLog).toBe(false);
    expect(useSettingsStore().confirmEndTurn).toBe(true);
  });

  it.each(['not json', '[]', 'null', '{"showLog":"no","confirmEndTurn":0}'])(
    'falls back to the defaults when storage holds %s',
    (saved) => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, saved);

      const settings = useSettingsStore();

      expect(settings.confirmEndTurn).toBe(true);
      expect(settings.showLog).toBe(true);
    }
  );

  it('keeps volumes within 0 to 100 and drops ones of the wrong type', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ masterVolume: 140, musicVolume: -5, effectsVolume: 'loud', muted: true })
    );

    const settings = useSettingsStore();

    expect(settings.masterVolume).toBe(100);
    expect(settings.musicVolume).toBe(0);
    expect(settings.effectsVolume).toBe(80);
    expect(settings.muted).toBe(true);
  });
});
