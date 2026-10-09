import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { RULES_VERSION } from '@vermont/core';
import App from './App.vue';

describe('App', () => {
  it('shows the battle canvas and the rules version', () => {
    const wrapper = mount(App, { global: { stubs: { BattleCanvas: true } } });

    expect(wrapper.find('battle-canvas-stub').exists()).toBe(true);
    expect(wrapper.text()).toContain(`pravidla v${RULES_VERSION}`);
  });
});
