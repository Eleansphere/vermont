import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';

describe('App', () => {
  it('shows the battle canvas and the rules version', () => {
    const wrapper = mount(App, { global: { stubs: { BattleCanvas: true } } });

    expect(wrapper.find('battle-canvas-stub').exists()).toBe(true);
    expect(wrapper.text()).toContain('pravidla v1');
  });
});
