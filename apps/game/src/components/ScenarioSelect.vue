<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Difficulty } from '@vermont/ai';
import { DIFFICULTIES } from '@vermont/ai';
import { PLAYER_SLOTS, SCENARIOS, armySize, opponentOf } from '@vermont/core';
import type { PlayerSlot, ScenarioDef } from '@vermont/core';
import { sideColor, sideName } from '../battle/labels';
import { difficultyName, plural, scenarioName, t } from '../i18n';
import type { UiKey } from '../i18n';
import MapPreview from './MapPreview.vue';
import type { StartOptions } from '../stores/battle';

const emit = defineEmits<{
  start: [scenarioId: string, options: StartOptions];
  back: [];
}>();

type Opponent = 'computer' | 'human';

const scenarios: readonly ScenarioDef[] = Object.values(SCENARIOS);
const chosenId = ref(scenarios[0]?.id ?? '');
const chosen = computed(() => scenarios.find((scenario) => scenario.id === chosenId.value));
const opponent = ref<Opponent>('computer');
/** The side the player takes against the computer. */
const side = ref<PlayerSlot>(0);
const difficulty = ref<Difficulty>('normal');
const autoDeploy = ref(false);
const fog = ref(true);

function start(): void {
  emit('start', chosenId.value, {
    deployment: autoDeploy.value ? 'auto' : 'manual',
    fog: fog.value,
    ...(opponent.value === 'computer' && {
      ai: { player: opponentOf(side.value), difficulty: difficulty.value },
    }),
  });
}

/** A few words about each shipped scenario: what happened there and what the map offers. */
const ABOUT: Readonly<Record<string, UiKey>> = {
  trebia: 'scenarios.about.trebia',
  cannae: 'scenarios.about.cannae',
  zama: 'scenarios.about.zama',
};

function armyText(scenario: ScenarioDef, player: 0 | 1): string {
  const count = armySize(scenario.sides[player]);
  return t('scenarios.units', { count, units: plural('units', count) });
}
</script>

<template>
  <main class="scenarios">
    <section class="scenarios__box panel">
      <h2 class="scenarios__title">{{ t('scenarios.title') }}</h2>

      <div class="scenarios__layout">
        <ul class="scenarios__list">
          <li v-for="scenario in scenarios" :key="scenario.id">
            <label class="scenario" :class="{ 'scenario--chosen': scenario.id === chosenId }">
              <input
                v-model="chosenId"
                class="visually-hidden"
                type="radio"
                name="scenario"
                :value="scenario.id"
              />
              <MapPreview class="scenario__thumb" :scenario="scenario" />
              <span class="scenario__body">
                <span class="scenario__name">{{ scenarioName(scenario) }}</span>
                <span class="scenario__sides">
                  <template v-for="player in PLAYER_SLOTS" :key="player">
                    <span v-if="player > 0" class="muted">{{ t('scenarios.versus') }}</span>
                    <span class="scenario__side">
                      <span class="scenario__dot" :style="{ background: sideColor(player) }" />
                      {{ sideName(scenario, player) }}
                      <span class="muted">({{ armyText(scenario, player) }})</span>
                    </span>
                  </template>
                </span>
              </span>
            </label>
          </li>
        </ul>

        <div v-if="chosen" class="scenarios__detail">
          <MapPreview class="scenarios__map" :scenario="chosen" />
          <p v-if="ABOUT[chosen.id]" class="scenarios__about" data-test="scenario-about">
            {{ t(ABOUT[chosen.id]!) }}
          </p>

          <div class="scenarios__group" role="radiogroup" :aria-label="t('scenarios.opponent')">
            <span class="scenarios__label">{{ t('scenarios.opponent') }}</span>
            <div class="segmented">
              <label
                v-for="kind in ['computer', 'human'] as const"
                :key="kind"
                class="segmented__option"
                :class="{ 'segmented__option--on': opponent === kind }"
              >
                <input
                  v-model="opponent"
                  class="visually-hidden"
                  type="radio"
                  name="opponent"
                  :value="kind"
                />
                {{ t(`scenarios.opponent.${kind}`) }}
              </label>
            </div>
          </div>

          <template v-if="opponent === 'computer'">
            <div class="scenarios__group" role="radiogroup" :aria-label="t('scenarios.side')">
              <span class="scenarios__label">{{ t('scenarios.side') }}</span>
              <div class="segmented">
                <label
                  v-for="player in PLAYER_SLOTS"
                  :key="player"
                  class="segmented__option"
                  :class="{ 'segmented__option--on': side === player }"
                >
                  <input
                    v-model="side"
                    class="visually-hidden"
                    type="radio"
                    name="side"
                    :value="player"
                  />
                  <span class="scenario__dot" :style="{ background: sideColor(player) }" />
                  {{ sideName(chosen, player) }}
                </label>
              </div>
            </div>
            <div class="scenarios__group" role="radiogroup" :aria-label="t('scenarios.difficulty')">
              <span class="scenarios__label">{{ t('scenarios.difficulty') }}</span>
              <div class="segmented">
                <label
                  v-for="level in DIFFICULTIES"
                  :key="level"
                  class="segmented__option"
                  :class="{ 'segmented__option--on': difficulty === level }"
                >
                  <input
                    v-model="difficulty"
                    class="visually-hidden"
                    type="radio"
                    name="difficulty"
                    :value="level"
                  />
                  {{ difficultyName(level) }}
                </label>
              </div>
            </div>
          </template>

          <label class="toggle">
            <input v-model="autoDeploy" class="toggle__input" type="checkbox" name="autoDeploy" />
            <span class="toggle__switch" aria-hidden="true" />
            {{ t('scenarios.autoDeploy') }}
          </label>
          <label class="toggle">
            <input v-model="fog" class="toggle__input" type="checkbox" name="fog" />
            <span class="toggle__switch" aria-hidden="true" />
            {{ t('scenarios.fog') }}
          </label>
        </div>
      </div>

      <div class="scenarios__actions">
        <button class="button" type="button" data-test="back" @click="emit('back')">
          {{ t('menu.back') }}
        </button>
        <button
          class="button button--primary"
          type="button"
          data-test="start"
          :disabled="!chosenId"
          @click="start"
        >
          {{ t('scenarios.start') }}
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.scenarios {
  display: grid;
  height: 100%;
  overflow-y: auto;
  background: radial-gradient(circle at 50% 30%, #2c3140, var(--bg) 70%);
}

.scenarios__box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(940px, calc(100% - 32px));
  margin: auto;
  padding: 20px 22px;
}

@media (max-height: 560px), (max-width: 600px) {
  .scenarios__box {
    gap: 10px;
    margin: 8px auto;
    padding: 12px 14px;
  }

  .scenarios__title {
    font-size: 20px;
  }

  /* The big map would push the start button far below; the thumbnails show it already. */
  .scenarios__map {
    display: none;
  }
}

.scenarios__title {
  font-size: 26px;
  color: var(--accent);
}

.scenarios__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 20px;
}

@media (width <= 760px) {
  .scenarios__layout {
    grid-template-columns: 1fr;
  }
}

.scenarios__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.scenario {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.scenario:hover {
  border-color: rgb(217 180 90 / 55%);
}

.scenario:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.scenario--chosen {
  border-color: var(--accent);
  background: rgb(217 180 90 / 8%);
}

.scenario__thumb {
  flex: none;
  width: 92px;
  border-radius: 3px;
  opacity: 0.9;
}

.scenario__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scenario__name {
  font-family: var(--font-display);
  font-size: 18px;
}

.scenario__sides,
.scenario__side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.scenario__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.scenarios__detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scenarios__map {
  padding: 8px;
  border-radius: 6px;
  background: rgb(0 0 0 / 25%);
}

.scenarios__about {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.scenarios__group {
  display: grid;
  gap: 4px;
}

.scenarios__label {
  color: var(--muted);
  font-size: 13px;
}

.segmented {
  display: flex;
  border: 1px solid var(--panel-border);
  border-radius: 5px;
  overflow: hidden;
}

.segmented__option {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  background: #2a2f3a;
  cursor: pointer;
  transition: background 0.15s;
}

.segmented__option + .segmented__option {
  border-left: 1px solid var(--panel-border);
}

.segmented__option:hover {
  background: #343a47;
}

.segmented__option:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.segmented__option--on {
  background: #5a4a24;
  color: var(--text);
}

.segmented__option--on:hover {
  background: #66552b;
}

.scenarios__actions {
  display: flex;
  justify-content: space-between;
}
</style>
