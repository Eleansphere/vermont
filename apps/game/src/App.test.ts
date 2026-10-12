import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import type { VueWrapper } from '@vue/test-utils';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { RULES_VERSION, fieldedUnits } from '@vermont/core';
import App from './App.vue';
import { SAVE_STORAGE_KEY } from './save/storage';
import { useBattleStore } from './stores/battle';
import { useSettingsStore } from './stores/settings';

let wrapper: VueWrapper;

function mountApp() {
  const pinia = createPinia();
  wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia], stubs: { BattleCanvas: true } },
  });
  return { store: useBattleStore(pinia), settings: useSettingsStore(pinia) };
}

const click = (name: string) => wrapper.find(`[data-test="${name}"]`).trigger('click');
const has = (name: string) => wrapper.find(`[data-test="${name}"]`).exists();
const text = (name: string) => wrapper.find(`[data-test="${name}"]`).text();

async function press(code: string, init: KeyboardEventInit = {}): Promise<void> {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, ...init }));
  await nextTick();
}

/**
 * Goes through the menu into a battle; with `autoDeploy` both armies are on the field, and
 * without `fog` both players see all of it.
 */
async function startBattle(autoDeploy: boolean, fog = true) {
  const stores = mountApp();
  await click('new-battle');
  await wrapper.find('input[name="opponent"][value="human"]').setValue(true);
  if (autoDeploy) await wrapper.find('input[name="autoDeploy"]').setValue(true);
  if (!fog) await wrapper.find('input[name="fog"]').setValue(false);
  await click('start');
  return stores;
}

describe('App', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => wrapper.unmount());

  describe('saved battle', () => {
    it('keeps the battle in the browser and offers to continue it on the next visit', async () => {
      const first = await startBattle(true, false);
      first.store.endTurn();
      await nextTick();
      const left = first.store.state;
      expect(left).toMatchObject({ phase: 'battle', activePlayer: 1 });
      wrapper.unmount();

      const { store } = mountApp();

      expect(store.state).toEqual(left);
      await click('continue');
      expect(text('turn')).toMatch(/^Kolo 1 z 20\s*na tahu\s*Kartágo$/);
    });

    it('forgets a battle that is over', async () => {
      const { store } = await startBattle(true);
      await nextTick();
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

      store.state = { ...store.state!, phase: 'ended', draw: true };
      await nextTick();
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
      wrapper.unmount();
      mountApp();

      expect(has('continue')).toBe(false);
    });

    it('says why a battle from an older version was not kept, once', async () => {
      const { store } = await startBattle(true);
      await nextTick();
      const saved = { ...store.savedGame!, rulesVersion: RULES_VERSION - 1 };
      wrapper.unmount();
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saved));

      mountApp();

      expect(has('continue')).toBe(false);
      expect(text('save-problem')).toBe('Uložená bitva je z jiné verze hry a nejde načíst.');
      expect(localStorage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    });

    it('loads a battle from a file and says so when the file is no save', async () => {
      const { store } = await startBattle(true, false);
      const saved = JSON.stringify(store.savedGame);
      const played = store.state;
      wrapper.unmount();
      localStorage.clear();
      const fresh = mountApp();
      const choose = async (content: string) => {
        const input = wrapper.find('input[data-test="save-file"]');
        Object.defineProperty(input.element, 'files', {
          value: [new File([content], 'save.json')],
          configurable: true,
        });
        await input.trigger('change');
        await new Promise((resolve) => setTimeout(resolve, 0));
        await nextTick();
      };

      await choose('holiday photo');
      expect(text('save-problem')).toBe('Tohle není uložená bitva hry Vermont.');
      expect(fresh.store.state).toBeNull();

      await choose(saved);
      expect(fresh.store.state).toEqual(played);
      expect(has('turn')).toBe(true);
    });
  });

  describe('menu', () => {
    it('opens on the main menu with the rules version', () => {
      mountApp();

      expect(wrapper.text()).toContain('Vermont');
      expect(wrapper.text()).toContain(`pravidla v${RULES_VERSION}`);
      expect(has('continue')).toBe(false);
    });

    it('offers the scenarios with their sides', async () => {
      mountApp();

      await click('new-battle');

      expect(wrapper.text()).toContain('Trebia (218 př. n. l.)');
      expect(wrapper.text()).toContain('Řím (13 jednotek)');
      expect(wrapper.text()).toContain('Kartágo (12 jednotek)');

      await click('back');
      expect(has('new-battle')).toBe(true);
    });

    it('starts a battle against the computer on the side and level chosen', async () => {
      const { store } = mountApp();
      await click('new-battle');
      await wrapper.find('input[name="side"][value="1"]').setValue(true);
      await wrapper.find('input[name="difficulty"][value="hard"]').setValue(true);
      await wrapper.find('input[name="autoDeploy"]').setValue(true);

      await click('start');

      // Rome moves first and is the computer's: the player watches from the other side.
      expect(store.viewer).toBe(1);
      expect(store.aiOnTurn).toBe(true);
      expect(text('turn')).toContain('počítač táhne');
      store.leave();
    });

    it('hides the choice of side and level when two players share the computer', async () => {
      mountApp();
      await click('new-battle');
      expect(wrapper.find('input[name="difficulty"]').exists()).toBe(true);

      await wrapper.find('input[name="opponent"][value="human"]').setValue(true);

      expect(wrapper.find('input[name="side"]').exists()).toBe(false);
      expect(wrapper.find('input[name="difficulty"]').exists()).toBe(false);
    });

    it('changes the settings', async () => {
      const { settings } = mountApp();

      await click('settings');
      await wrapper.find('input[name="showLog"]').setValue(false);

      expect(settings.showLog).toBe(false);
    });

    it('comes back to a battle that was left for the menu', async () => {
      const { store } = await startBattle(true);
      const battle = store.state;

      await click('menu');
      await click('main-menu');
      await click('continue');

      expect(store.state).toBe(battle);
      expect(has('turn')).toBe(true);
    });
  });

  describe('deployment', () => {
    it('starts with the first player deploying by hand', async () => {
      const { store } = await startBattle(false);

      expect(text('turn')).toMatch(/^Rozestavení\s*na tahu\s*Řím$/);
      expect(text('deployment')).toContain('Čeká na rozestavení: 13');
      expect(wrapper.find('[data-test="end-deployment"]').attributes('disabled')).toBeDefined();
      expect(has('end-turn')).toBe(false);
      expect(text('unit-panel')).toContain('V záloze');
      expect(store.state?.phase).toBe('deployment');
    });

    it('picks a waiting unit from the list', async () => {
      const { store } = await startBattle(false);
      const third = store.reserve[2]!;

      await click(`reserve-${third.id}`);

      expect(store.selectedUnitId).toBe(third.id);
    });

    it('deploys both armies with the buttons and Enter, then shows the battle', async () => {
      const { store } = await startBattle(false);

      await click('auto-deploy');
      expect(text('deployment')).toContain('Všechny jednotky stojí na poli.');
      await click('end-deployment');
      expect(text('turn')).toMatch(/^Rozestavení\s*na tahu\s*Kartágo$/);
      expect(text('handover')).toContain('Na řadě: Kartágo');
      await click('take-seat');

      await click('auto-deploy');
      await press('Enter');
      expect(text('handover')).toContain('Na řadě: Řím');
      await press('Enter');

      expect(has('handover')).toBe(false);
      expect(store.state?.phase).toBe('battle');
      expect(has('deployment')).toBe(false);
      expect(text('turn')).toMatch(/^Kolo 1 z 20\s*na tahu\s*Řím$/);
      expect(text('log')).toContain('Bitva začíná.');
    });

    it('takes a deployment back with the button', async () => {
      const { store } = await startBattle(false);
      await click('auto-deploy');

      await click('undo');

      expect(store.reserve).toHaveLength(13);
    });
  });

  describe('battle', () => {
    it('shows whose turn it is and how the armies stand', async () => {
      await startBattle(true);

      expect(text('turn')).toMatch(/^Kolo 1 z 20\s*na tahu\s*Řím$/);
      expect(text('army-0')).toContain('Řím');
      expect(text('army-0')).toContain('v boji 13 z 13');
      expect(text('army-1')).toContain('Kartágo');
      expect(wrapper.find('battle-canvas-stub').exists()).toBe(true);
    });

    it('asks before ending a turn in which units could still act', async () => {
      const { store } = await startBattle(true);

      await click('end-turn');
      expect(wrapper.text()).toContain('Některé jednotky ještě mohou jednat (13)');
      expect(store.state?.activePlayer).toBe(0);

      await click('cancel');
      expect(store.state?.activePlayer).toBe(0);

      await press('Enter');
      await press('Enter');
      expect(store.state?.activePlayer).toBe(1);
      expect(text('turn')).toMatch(/^Kolo 1 z 20\s*na tahu\s*Kartágo$/);
    });

    it('ends the turn at once when the player does not want to be asked', async () => {
      const { store, settings } = await startBattle(true);
      settings.confirmEndTurn = false;

      await click('end-turn');

      expect(store.state?.activePlayer).toBe(1);
    });

    it('shows the selected unit with its values and abilities', async () => {
      const { store } = await startBattle(true);
      expect(has('unit-panel')).toBe(false);

      store.select('p0-hastati-2');
      await nextTick();

      const panel = text('unit-panel');
      expect(panel).toContain('Hastati 2');
      expect(panel).toContain('Těžká pěchota');
      expect(panel).toContain('pevná');
      expect(text('bar-hp')).toContain('10/10');
      expect(text('bar-movement')).toContain('4/4');
      expect(panel).toContain('Pilum');
      expect(has('relief')).toBe(false);
    });

    it('walks through the units with Tab and drops the selection with Escape', async () => {
      const { store } = await startBattle(true);

      await press('Tab');
      expect(store.selectedUnitId).toBe(store.readyUnits[0]!.id);
      await press('Tab', { shiftKey: true });
      expect(store.selectedUnitId).toBe(store.readyUnits.at(-1)!.id);

      await press('Escape');
      expect(store.selectedUnitId).toBeNull();
    });

    it('orders a line relief with the button and with R', async () => {
      const { store } = await startBattle(true);
      store.select('p0-principes-1');
      await nextTick();

      await click('relief');
      expect(store.order).toBe('relief');
      expect(text('unit-panel')).toContain('Vyber sousední jednotku');

      await press('KeyR');
      expect(store.order).toBe('move');
    });

    it('takes a move back with Backspace', async () => {
      const { store } = await startBattle(true);
      const before = store.state;
      const unit = fieldedUnits(before!, 0)[0]!;
      store.pick({ hex: unit.pos, unitId: unit.id });
      store.pick({ hex: store.highlights.reach![0]! });
      expect(store.state).not.toBe(before);

      await press('Backspace');

      expect(store.state).toBe(before);
    });

    it('hides and shows the log with L', async () => {
      await startBattle(true);
      expect(has('log')).toBe(true);

      await press('KeyL');
      expect(has('log')).toBe(false);

      await press('KeyL');
      expect(has('log')).toBe(true);
    });

    it('describes the hex under the pointer in a tooltip', async () => {
      const { store } = await startBattle(true, false);
      expect(has('tooltip')).toBe(false);

      store.hover(fieldedUnits(store.state!, 1)[0]!.pos);
      await nextTick();

      expect(text('tooltip')).toContain('Rovina');
      expect(text('tooltip')).toContain('Numidská jízda 1');
      expect(has('preview')).toBe(false);
      expect(has('tooltip-fog')).toBe(false);
    });

    it('does not show an enemy the player cannot see', async () => {
      const { store } = await startBattle(true);

      store.hover(fieldedUnits(store.state!, 1)[0]!.pos);
      await nextTick();

      expect(text('tooltip')).not.toContain('Numidská jízda');
      expect(text('tooltip-fog')).toBe('mimo dohled');
    });

    it('covers the battle between the turns and takes no orders meanwhile', async () => {
      const { store, settings } = await startBattle(true);
      settings.confirmEndTurn = false;

      await press('Enter');
      expect(store.state?.activePlayer).toBe(1);
      expect(text('handover')).toContain('Na řadě: Kartágo');
      expect(text('handover')).toContain('Kolo 1');
      expect(has('tooltip')).toBe(false);

      await press('Escape');
      expect(has('resume')).toBe(false);
      await press('Tab');
      expect(store.selectedUnitId).toBeNull();

      await press('Enter');

      expect(has('handover')).toBe(false);
      expect(store.state?.activePlayer).toBe(1);
    });

    it('says why an order was refused', async () => {
      const { store } = await startBattle(true);

      store.send({ type: 'EndDeployment' });
      await nextTick();

      expect(text('rejection')).toBe('To teď nejde.');
    });

    it('opens the pause menu with Escape and restarts the battle from it', async () => {
      const { store } = await startBattle(true);
      store.endTurn();
      store.takeSeat();

      await press('Escape');
      expect(has('resume')).toBe(true);
      await press('Enter');
      expect(store.state?.activePlayer).toBe(1);

      await click('restart');

      expect(store.state?.activePlayer).toBe(0);
      expect(has('resume')).toBe(false);
    });

    it('announces the winner', async () => {
      const { store } = await startBattle(true);
      store.state = {
        ...store.state!,
        phase: 'ended',
        winner: { player: 1, reason: 'armyBroken' },
      };
      await nextTick();

      expect(text('result')).toContain('Vítězství: Kartágo');
      expect(text('result')).toContain('armáda soupeře je zlomena');
    });

    it('announces a draw', async () => {
      const { store } = await startBattle(true);
      store.state = { ...store.state!, phase: 'ended', draw: true };
      await nextTick();

      expect(text('result')).toContain('Remíza');
      expect(text('result')).toContain('po 20 kolech nikdo nezvítězil');
    });
  });
});
