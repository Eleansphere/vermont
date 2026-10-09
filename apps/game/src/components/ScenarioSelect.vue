<script setup lang="ts">
import { ref } from 'vue';
import { PLAYER_SLOTS, SCENARIOS, armySize } from '@vermont/core';
import type { ScenarioDef } from '@vermont/core';
import { sideColor, sideName } from '../battle/labels';
import { plural, scenarioName, t } from '../i18n';
import type { DeploymentMode } from '../stores/battle';

const emit = defineEmits<{ start: [scenarioId: string, deployment: DeploymentMode]; back: [] }>();

const scenarios: readonly ScenarioDef[] = Object.values(SCENARIOS);
const chosenId = ref(scenarios[0]?.id ?? '');
const autoDeploy = ref(false);

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

      <label class="scenarios__option">
        <input v-model="autoDeploy" type="checkbox" name="autoDeploy" />
        {{ t('scenarios.autoDeploy') }}
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
          @click="emit('start', chosenId, autoDeploy ? 'auto' : 'manual')"
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

.scenarios__actions {
  display: flex;
  justify-content: space-between;
}
</style>
