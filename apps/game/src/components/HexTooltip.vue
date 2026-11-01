<script setup lang="ts">
import { computed } from 'vue';
import type { AttackFactor, BattleDefs, DamageRange } from '@vermont/core';
import { hexEquals, terrainMoveCost, unitTypeOf } from '@vermont/core';
import { formatNumber, formatSigned } from '../battle/format';
import { sideColor, sideName, unitLabel } from '../battle/labels';
import { moraleStateName, plural, t, terrainName } from '../i18n';
import { useBattleStore } from '../stores/battle';

/** Where the pointer is, in pixels from the corner of the battle screen. */
const props = defineProps<{ x: number; y: number }>();

const store = useBattleStore();

/** How far from the pointer the tooltip sits, so it never covers the hex it describes. */
const OFFSET = 18;
/** Room the tooltip needs; near the right or bottom edge it goes to the other side. */
const WIDTH = 280;
const HEIGHT = 260;

function range({ min, max }: DamageRange): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

function factorText(factor: AttackFactor, defs: BattleDefs): string {
  const value = factor.value ?? 0;
  switch (factor.id) {
    case 'advantage':
      return t('tip.factor.advantage', { value: formatNumber(defs.rules.combat.advantageFactor) });
    case 'flank':
      return t('tip.factor.flank', {
        count: value,
        units: plural('units', value),
        percent: Math.round(defs.rules.combat.flankBonus * value * 100),
      });
    case 'wounded':
    case 'shaken':
      return t(`tip.factor.${factor.id}`);
    default:
      return t(`tip.factor.${factor.id}`, { value: formatSigned(value) });
  }
}

const view = computed(() => {
  const { state, defs, scenario, hoverInfo: info } = store;
  if (!state || !defs || !scenario || !info) return null;

  const { terrain, unit, preview, factors } = info;
  // What the ground costs the selected unit, or anybody when no unit is selected.
  const mover = store.commandedUnit;
  const cost = mover
    ? terrainMoveCost(terrain, unitTypeOf(defs, mover).archetype)
    : terrain.moveCost;
  const facts = [
    cost === null ? t('tip.impassable') : t('tip.moveCost', { cost: formatNumber(cost) }),
    terrain.defenseBonus !== 0 && t('tip.defense', { bonus: formatSigned(terrain.defenseBonus) }),
    terrain.attackBonus && t('tip.attack', { bonus: formatSigned(terrain.attackBonus) }),
    terrain.isHill && t('tip.hill'),
    terrain.blocksSight && t('tip.blocksSight'),
  ].filter((fact): fact is string => typeof fact === 'string');
  const type = unit && unitTypeOf(defs, unit);

  return {
    terrain: terrainName(terrain.id),
    facts,
    camp: info.campOf === null ? null : t('tip.camp', { side: sideName(scenario, info.campOf) }),
    fogged: info.fogged,
    mustStop: !unit && (store.highlights.zoc ?? []).some((stop) => hexEquals(stop, info.hex)),
    unit: unit &&
      type && {
        label: unitLabel(state, defs, unit),
        color: sideColor(unit.owner),
        hp: unit.hp,
        maxHp: type.hp,
        morale: unit.morale,
        maxMorale: defs.rules.morale.max,
        moraleName: moraleStateName(unit.moraleState),
        moraleState: unit.moraleState,
        attack: type.attack,
        defense: type.defense,
      },
    preview: preview && {
      kind: t(`tip.kind.${preview.kind}`),
      dealt: range(preview.damage),
      taken: preview.counterDamage ? range(preview.counterDamage) : null,
      targetMorale: factors && t('tip.targetMorale', { loss: formatSigned(-factors.moraleLoss) }),
      encircled: factors?.encircled ?? false,
      factors: (factors?.factors ?? []).map((factor) => ({
        text: factorText(factor, defs),
        helps: factor.helps,
      })),
    },
  };
});

const position = computed(() => {
  const right = props.x + OFFSET + WIDTH > window.innerWidth;
  const below = props.y + OFFSET + HEIGHT > window.innerHeight;
  return {
    left: `${right ? props.x - OFFSET - WIDTH : props.x + OFFSET}px`,
    top: `${below ? Math.max(8, props.y - OFFSET - HEIGHT) : props.y + OFFSET}px`,
  };
});

/** On a touch screen a shown move or attack waits for a second tap; the tip says so. */
const tapAgain = computed(() => {
  const armed = store.armedHex;
  const info = store.hoverInfo;
  if (!armed || !info || !hexEquals(armed, info.hex)) return null;
  return t(info.preview ? 'tip.tapAgainAttack' : 'tip.tapAgainMove');
});

const percent = (value: number, max: number) => `${Math.round((value / max) * 100)}%`;
</script>

<template>
  <div v-if="view" class="tip panel" :style="position" role="tooltip" data-test="tooltip">
    <div class="tip__terrain">
      <strong>{{ view.terrain }}</strong>
      <span class="muted">{{ view.facts.join(' · ') }}</span>
    </div>
    <div v-if="view.camp" class="tip__camp">{{ view.camp }}</div>
    <div v-if="view.mustStop" class="tip__stop" data-test="tooltip-stop">
      {{ t('tip.mustStop') }}
    </div>
    <div v-if="view.fogged" class="muted" data-test="tooltip-fog">{{ t('tip.fogged') }}</div>

    <div v-if="view.unit" class="tip__unit" :style="{ borderColor: view.unit.color }">
      <strong>{{ view.unit.label }}</strong>
      <div class="tip__meter">
        <span class="muted">{{ t('unit.hp') }}</span>
        <span class="tip__bar">
          <span
            class="tip__fill tip__fill--hp"
            :style="{ width: percent(view.unit.hp, view.unit.maxHp) }"
          />
        </span>
        <span>{{ view.unit.hp }}/{{ view.unit.maxHp }}</span>
      </div>
      <div class="tip__meter">
        <span class="muted">{{ t('unit.morale') }}</span>
        <span class="tip__bar">
          <span
            class="tip__fill tip__fill--morale"
            :style="{ width: percent(view.unit.morale, view.unit.maxMorale) }"
          />
        </span>
        <span :class="`tip__morale--${view.unit.moraleState}`">{{ view.unit.moraleName }}</span>
      </div>
      <span class="muted">
        {{ t('unit.attack') }} {{ view.unit.attack }} · {{ t('unit.defense') }}
        {{ view.unit.defense }}
      </span>
    </div>

    <div v-if="view.preview" class="tip__preview" data-test="preview">
      <div class="tip__preview-title">
        <strong>{{ t('tip.preview') }}</strong>
        <span class="muted">{{ view.preview.kind }}</span>
      </div>
      <div class="tip__outcome">
        <div class="tip__number tip__number--dealt">
          <span class="muted">{{ t('tip.dealt') }}</span>
          <strong data-test="preview-dealt">{{ view.preview.dealt }}</strong>
        </div>
        <div class="tip__number tip__number--taken">
          <span class="muted">{{ t('tip.taken') }}</span>
          <strong data-test="preview-taken">{{ view.preview.taken ?? t('tip.none') }}</strong>
        </div>
      </div>
      <div v-if="view.preview.targetMorale" class="tip__morale-loss">
        {{ view.preview.targetMorale }}
        <span v-if="view.preview.encircled" class="muted">({{ t('tip.encircled') }})</span>
      </div>
      <ul v-if="view.preview.factors.length > 0" class="tip__factors">
        <li
          v-for="factor in view.preview.factors"
          :key="factor.text"
          :class="factor.helps ? 'tip__factor--good' : 'tip__factor--bad'"
        >
          {{ factor.text }}
        </li>
      </ul>
    </div>
    <div v-if="tapAgain" class="tip__confirm" data-test="tap-again">{{ tapAgain }}</div>
  </div>
</template>

<style scoped>
.tip {
  position: absolute;
  z-index: 5;
  display: grid;
  gap: 8px;
  width: max-content;
  max-width: 280px;
  padding: 8px 10px;
  font-size: 13px;
  pointer-events: none;
}

.tip__terrain,
.tip__unit,
.tip__preview {
  display: grid;
  gap: 2px;
}

.tip__unit {
  padding-left: 7px;
  border-left: 3px solid;
}

.tip__confirm {
  padding: 4px 6px;
  border-radius: 4px;
  background: rgb(217 180 90 / 18%);
  color: var(--accent);
  font-weight: 600;
}

/* On a phone the tip does not follow the finger, which would cover it; it waits at the side. */
@media (max-width: 900px), (max-height: 560px) {
  .tip {
    top: calc(62px + env(safe-area-inset-top)) !important;
    right: calc(56px + env(safe-area-inset-right));
    left: auto !important;
    max-width: min(260px, calc(100% - 120px));
    max-height: calc(100% - 130px);
    overflow: hidden;
    font-size: 12px;
  }
}

@media (max-width: 600px) {
  .tip {
    top: calc(136px + env(safe-area-inset-top)) !important;
  }
}

.tip__meter {
  display: grid;
  grid-template-columns: 56px 80px auto;
  align-items: center;
  gap: 6px;
}

.tip__bar {
  height: 5px;
  border-radius: 3px;
  background: rgb(255 255 255 / 12%);
  overflow: hidden;
}

.tip__fill {
  display: block;
  height: 100%;
}

.tip__fill--hp {
  background: var(--good);
}

.tip__fill--morale {
  background: var(--morale);
}

.tip__morale--shaken,
.tip__camp {
  color: var(--accent);
}

.tip__morale--routing,
.tip__stop {
  color: var(--danger);
}

.tip__preview {
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--panel-border);
}

.tip__preview-title {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.tip__preview-title strong {
  color: var(--accent);
}

.tip__outcome {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tip__number {
  display: grid;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgb(255 255 255 / 5%);
}

.tip__number strong {
  font-size: 20px;
  line-height: 1.2;
}

.tip__number--dealt strong {
  color: var(--good);
}

.tip__number--taken strong {
  color: var(--danger);
}

.tip__factors {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tip__factors li {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}

.tip__factor--good {
  background: rgb(134 181 108 / 20%);
  color: #b7dc9f;
}

.tip__factor--bad {
  background: rgb(224 104 90 / 20%);
  color: #f0a79d;
}
</style>
