import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { RULES_VERSION } from '@vermont/core';
import App from './App.vue';
import { useBattleStore } from './stores/battle';

function mountApp() {
  const pinia = createPinia();
  const wrapper = mount(App, { global: { plugins: [pinia], stubs: { BattleCanvas: true } } });
  return { wrapper, store: useBattleStore(pinia) };
}

describe('App', () => {
  it('shows the battle canvas and the rules version', () => {
    const { wrapper } = mountApp();

    expect(wrapper.find('battle-canvas-stub').exists()).toBe(true);
    expect(wrapper.text()).toContain(`pravidla v${RULES_VERSION}`);
  });

  it('starts a battle and says whose turn it is', () => {
    const { wrapper, store } = mountApp();

    expect(store.state?.phase).toBe('battle');
    expect(wrapper.find('.game__status').text()).toBe('Kolo 1 · na tahu Rome');
  });

  it('ends the turn with the button', async () => {
    const { wrapper, store } = mountApp();

    await wrapper.find('.game__end-turn').trigger('click');

    expect(store.state?.activePlayer).toBe(1);
    expect(wrapper.find('.game__status').text()).toBe('Kolo 1 · na tahu Carthage');
  });
});
