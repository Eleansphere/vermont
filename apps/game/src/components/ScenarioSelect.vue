<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Difficulty } from '@vermont/ai';
import { DIFFICULTIES } from '@vermont/ai';
import { PLAYER_SLOTS, SCENARIOS, armySize, opponentOf } from '@vermont/core';
import type { PlayerSlot, ScenarioDef } from '@vermont/core';
import { sideColor, sideName } from '../battle/labels';
import { difficultyName, plural, scenarioName, t } from '../i18n';
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

function armyText(scenario: ScenarioDef, player: 0 | 1): string {
  const count = armySize(scenario.sides[player]);
  return t('scenarios.units', { count, units: plural('units', count) });
}
</script>

<template>
  <main class="scenarios">
    <section class="scenarios__box panel">
      <h2 class="scenarios__title">{{ t('scenarios.title') }}</h2>

      <ul class="scenarios__list">
        <li v-for="scenario in scenarios" :key="scenario.id">
          <label class="scenario" :class="{ 'scenario--chosen': scenario.id === chosenId }">
            <input v-model="chosenId" type="radio" name="scenario" :value="scenario.id" />
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

      <fieldset class="scenarios__group">
        <legend>{{ t('scenarios.opponent') }}</legend>
        <label v-for="kind in ['computer', 'human'] as const" :key="kind" class="scenarios__option">
          <input v-model="opponent" type="radio" name="opponent" :value="kind" />
          {{ t(`scenarios.opponent.${kind}`) }}
        </label>
      </fieldset>

      <template v-if="opponent === 'computer' && chosen">
        <fieldset class="scenarios__group">
          <legend>{{ t('scenarios.side') }}</legend>
          <label v-for="player in PLAYER_SLOTS" :key="player" class="scenarios__option">
            <input v-model="side" type="radio" name="side" :value="player" />
            <span class="scenario__dot" :style="{ background: sideColor(player) }" />
            {{ sideName(chosen, player) }}
          </label>
        </fieldset>
        <fieldset class="scenarios__group">
          <legend>{{ t('scenarios.difficulty') }}</legend>
          <label v-for="level in DIFFICULTIES" :key="level" class="scenarios__option">
            <input v-model="difficulty" type="radio" name="difficulty" :value="level" />
            {{ difficultyName(level) }}
          </label>
        </fieldset>
      </template>

      <label class="scenarios__option">
        <input v-model="autoDeploy" type="checkbox" name="autoDeploy" />
        {{ t('scenarios.autoDeploy') }}
      </label>
      <label class="scenarios__option">
        <input v-model="fog" type="checkbox" name="fog" />
        {{ t('scenarios.fog') }}
      </label>

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
  place-items: center;
  height: 100%;
  background: radial-gradient(circle at 50% 30%, #2c3140, var(--bg) 70%);
}

.scenarios__box {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: min(520px, calc(100% - 32px));
  padding: 18px 20px;
}

.scenarios__title {
  font-size: 26px;
  color: var(--accent);
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
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
  cursor: pointer;
}

.scenario--chosen {
  border-color: var(--accent);
  background: rgb(217 180 90 / 8%);
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
}

.scenario__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.scenarios__option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.scenarios__group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 4px;
}

.scenarios__group legend {
  padding: 0 6px;
  color: var(--muted, inherit);
  font-size: 13px;
}

.scenarios__actions {
  display: flex;
  justify-content: space-between;
}
</style>
