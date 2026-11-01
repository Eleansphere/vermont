<script setup lang="ts">
import { computed } from 'vue';
import { armyRoster } from '../battle/roster';
import { sideColor } from '../battle/labels';
import { moraleStateName, t } from '../i18n';
import { useBattleStore } from '../stores/battle';
import { useTutorialStore } from '../stores/tutorial';
import UnitIcon from './UnitIcon.vue';

const store = useBattleStore();
const tutorial = useTutorialStore();

const SIGNS = { shaken: '!', routing: '»' } as const;

/** The player's army at the screen: every unit on the field, with what it can still do. */
const army = computed(() => {
  const { known, defs, viewer } = store;
  if (!known || !defs || known.phase !== 'battle') return null;
  const ready = new Set(store.readyUnits.map((unit) => unit.id));
  const spent = new Set(store.spentUnitIds);
  const units = armyRoster(known, defs, viewer).map((entry) => ({
    ...entry,
    ready: ready.has(entry.id),
    spent: spent.has(entry.id),
    selected: entry.id === store.selectedUnitId,
    health: Math.min(Math.max(entry.hp / entry.maxHp, 0), 1),
    moraleShare: Math.min(Math.max(entry.morale / entry.maxMorale, 0), 1),
    sign: entry.moraleState === 'steady' ? null : SIGNS[entry.moraleState],
  }));
  return { units, color: sideColor(viewer), ready: ready.size };
});

const locked = computed(() => store.aiOnTurn || store.handover !== null);

function title(unit: NonNullable<typeof army.value>['units'][number]): string {
  const state = unit.spent ? t('army.spent') : unit.ready ? t('army.canAct') : '';
  return [
    unit.label,
    `${t('unit.hp')} ${Math.ceil(unit.hp)}/${unit.maxHp}`,
    `${t('unit.morale')} ${unit.morale}/${unit.maxMorale} (${moraleStateName(unit.moraleState)})`,
    state,
  ]
    .filter(Boolean)
    .join(' · ');
}
</script>

<template>
  <nav
    v-if="army"
    class="army panel"
    :class="{ spotlight: tutorial.spot === 'armyBar' }"
    :aria-label="t('army.title')"
    data-test="army-bar"
  >
    <span class="army__count" :class="{ muted: army.ready === 0 }">
      {{
        store.aiOnTurn
          ? t('army.title')
          : t('army.ready', { ready: army.ready, total: army.units.length })
      }}
    </span>
    <ol class="army__list">
      <li v-for="unit in army.units" :key="unit.id">
        <button
          type="button"
          class="army__unit"
          :class="{
            'army__unit--spent': unit.spent,
            'army__unit--selected': unit.selected,
          }"
          :style="{ '--side': army.color }"
          :title="title(unit)"
          :aria-label="title(unit)"
          :aria-pressed="unit.selected"
          :disabled="locked"
          :data-test="`army-${unit.id}`"
          @click="store.selectAndShow(unit.id)"
        >
          <span class="army__icon">
            <UnitIcon :archetype="unit.icon.archetype" :pips="unit.icon.pips" />
          </span>
          <span class="army__body">
            <span
              class="army__hp"
              :class="{
                'army__hp--hurt': unit.health < 0.66,
                'army__hp--bad': unit.health < 0.33,
              }"
            >
              {{ Math.ceil(unit.hp) }}
            </span>
            <span
              v-if="unit.sign"
              class="army__sign"
              :class="`army__sign--${unit.moraleState}`"
              aria-hidden="true"
            >
              {{ unit.sign }}
            </span>
            <span class="army__morale">
              <span :style="{ width: `${unit.moraleShare * 100}%` }" />
            </span>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.army {
  position: absolute;
  bottom: 10px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 660px);
  padding: 6px 10px;
  transform: translateX(-50%);
}

@media (max-width: 900px), (max-height: 560px) {
  .army {
    right: calc(56px + env(safe-area-inset-right));
    bottom: calc(6px + env(safe-area-inset-bottom));
    left: calc(212px + env(safe-area-inset-left));
    max-width: none;
    padding: 4px 6px;
    transform: none;
  }

  .army__count {
    display: none;
  }

  .army__list {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .army__unit {
    flex: none;
    height: 32px;
  }
}

@media (max-width: 600px) {
  .army {
    left: calc(6px + env(safe-area-inset-left));
    right: calc(6px + env(safe-area-inset-right));
  }
}

.army__count {
  flex: none;
  max-width: 76px;
  font-size: 12px;
  line-height: 1.3;
}

.army__list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.army__unit {
  display: flex;
  width: 56px;
  height: 24px;
  padding: 0;
  border: 1.5px solid var(--side);
  border-radius: 5px;
  background: rgb(24 27 34 / 92%);
  color: var(--text);
  font: inherit;
  cursor: pointer;
  overflow: hidden;
}

.army__unit:disabled {
  cursor: default;
}

.army__unit:not(:disabled):hover {
  filter: brightness(1.25);
}

.army__unit--selected {
  outline: 2.5px solid #ffd23f;
  outline-offset: 1px;
}

.army__unit--spent {
  border-color: #59606c;
  opacity: 0.6;
}

.army__icon {
  display: grid;
  flex: none;
  place-items: center;
  align-content: center;
  width: 22px;
  background: var(--side);
  color: #fff;
  font-size: 15px;
}

.army__unit--spent .army__icon {
  background: #59606c;
}

.army__body {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding-bottom: 3px;
}

.army__hp {
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.army__hp--hurt {
  color: #f0c13c;
}

.army__hp--bad {
  color: #ff6b57;
}

.army__sign {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  color: #15171c;
  font-size: 10px;
  font-weight: bold;
}

.army__sign--shaken {
  background: #f0c13c;
}

.army__sign--routing {
  background: #e5533d;
}

.army__morale {
  position: absolute;
  right: 3px;
  bottom: 3px;
  left: 3px;
  height: 2px;
  background: #353c49;
}

.army__morale span {
  display: block;
  height: 100%;
  background: var(--morale);
}
</style>
