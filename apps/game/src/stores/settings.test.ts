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
});
