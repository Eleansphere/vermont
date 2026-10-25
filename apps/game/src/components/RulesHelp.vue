<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Archetype, TerrainDef, UnitTypeDef } from '@vermont/core';
import { FACTIONS, RULES, TERRAINS, UNIT_TYPES } from '@vermont/core';
import { formatNumber, formatSigned } from '../battle/format';
import type { HelpTab } from '../battle/help';
import { HELP_TABS } from '../battle/help';
import type { UiKey } from '../i18n';
import { abilityText, archetypeName, factionName, t, terrainName, unitTypeName } from '../i18n';
import ShortcutList from './ShortcutList.vue';

/** The tab to open with; the tutorial sends the player straight to the one it talks about. */
const props = withDefaults(defineProps<{ tab?: HelpTab }>(), { tab: 'basics' });

const active = ref<HelpTab>(props.tab);

const { combat, morale } = RULES;
const percent = (share: number) => formatNumber(Math.round(share * 100));

/** The paragraphs of the tabs made of text, with the numbers filled in from the rules. */
const TEXTS: Partial<Record<HelpTab, readonly [UiKey, Record<string, string | number>?][]>> = {
  basics: [
    ['help.basics.goal'],
    ['help.basics.turns'],
    ['help.basics.deploy'],
    ['help.basics.limit', { limit: RULES.roundLimit }],
    ['help.basics.fog', { campSight: RULES.fog.campSight }],
  ],
  movement: [
    ['help.movement.points'],
    ['help.movement.zoc'],
    ['help.movement.hill'],
    ['help.movement.ambush'],
  ],
  combat: [
    ['help.combat.attack'],
    ['help.combat.damage', { spread: percent(combat.damageSpread) }],
    ['help.combat.counter'],
    ['help.combat.types', { advantage: formatNumber(combat.advantageFactor) }],
    ['help.combat.flank', { flank: percent(combat.flankBonus) }],
    [
      'help.combat.terrain',
      {
        downhill: formatNumber(combat.downhillAttack),
        hindered: formatSigned(combat.hinderedAttack),
      },
    ],
    ['help.combat.preview'],
  ],
  morale: [
    [
      'help.morale.states',
      {
        max: morale.max,
        shaken: morale.shakenAt,
        penalty: percent(1 - morale.shakenAttackFactor),
        routing: morale.routingAt,
      },
    ],
    [
      'help.morale.loss',
      {
        hit: morale.lossWhenHit,
        encircled: morale.lossWhenEncircled,
        encircledAt: morale.encircledAt,
        worn: morale.lossWhenWorn,
        allyDies: morale.lossWhenAllyDies,
      },
    ],
    ['help.morale.gain', { won: morale.gainForWonAttack, recovery: morale.recoveryPerTurn }],
    ['help.morale.rout'],
    ['help.morale.camp'],
    ['help.morale.elephants'],
  ],
};

const paragraphs = computed(() =>
  (TEXTS[active.value] ?? []).map(([key, params]) => t(key, params))
);

const archetypes = (list: readonly Archetype[]) =>
  list.map((archetype) => archetypeName(archetype).toLocaleLowerCase('cs')).join(', ');

function unitRow(type: UnitTypeDef) {
  return {
    id: type.id,
    name: unitTypeName(type),
    archetype: archetypeName(type.archetype),
    stats: [
      type.attack,
      type.defense,
      type.hp,
      formatNumber(type.movement),
      type.sight,
      type.range ?? '–',
      type.morale,
    ],
    strong: archetypes(combat.advantages[type.archetype]) || '–',
    abilities: type.abilities.map((id) => abilityText(id)),
  };
}

const factions = Object.values(FACTIONS).map((faction) => ({
  id: faction.id,
  name: factionName(faction),
  units: faction.unitTypes.flatMap((id) => (UNIT_TYPES[id] ? [unitRow(UNIT_TYPES[id])] : [])),
}));

const UNIT_STATS: readonly UiKey[] = [
  'unit.attack',
  'unit.defense',
  'unit.hp',
  'unit.movement',
  'unit.sight',
  'unit.range',
  'unit.morale',
];

function terrainNotes(terrain: TerrainDef): string {
  return [
    terrain.moveCost === null && t('help.note.impassable'),
    terrain.isHill && t('help.note.hill'),
    terrain.blocksSight && !terrain.isHill && t('help.note.blocksSight'),
    terrain.impassableFor?.length &&
      t('help.note.impassableFor', { archetypes: archetypes(terrain.impassableFor) }),
    terrain.hinders?.length && t('help.note.hinders', { archetypes: archetypes(terrain.hinders) }),
  ]
    .filter((note): note is string => typeof note === 'string')
    .join(', ');
}

const terrains = Object.values(TERRAINS).map((terrain) => ({
  id: terrain.id,
  name: terrainName(terrain.id),
  move: terrain.moveCost === null ? '–' : formatNumber(terrain.moveCost),
  defense: terrain.defenseBonus === 0 ? '–' : formatSigned(terrain.defenseBonus),
  attack: terrain.attackBonus ? formatSigned(terrain.attackBonus) : '–',
  notes: terrainNotes(terrain),
}));
</script>

<template>
  <div class="help" data-test="help">
    <nav class="help__tabs" role="tablist">
      <button
        v-for="name in HELP_TABS"
        :key="name"
        type="button"
        role="tab"
        class="help__tab"
        :class="{ 'help__tab--active': name === active }"
        :aria-selected="name === active"
        :data-test="`help-tab-${name}`"
        @click="active = name"
      >
        {{ t(`help.tab.${name}`) }}
      </button>
    </nav>

    <div class="help__body" role="tabpanel">
      <template v-if="paragraphs.length > 0">
        <p v-for="text in paragraphs" :key="text" class="help__text">{{ text }}</p>
      </template>

      <template v-else-if="active === 'units'">
        <p class="help__text muted">{{ t('help.units.intro') }}</p>
        <section v-for="faction in factions" :key="faction.id" class="help__faction">
          <h3>{{ faction.name }}</h3>
          <table class="help__table">
            <thead>
              <tr>
                <th>{{ t('help.col.unit') }}</th>
                <th v-for="stat in UNIT_STATS" :key="stat" class="help__num">{{ t(stat) }}</th>
                <th>{{ t('help.col.strong') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="unit in faction.units" :key="unit.id" :data-test="`help-unit-${unit.id}`">
                <td>
                  <strong>{{ unit.name }}</strong>
                  <span class="help__sub muted">{{ unit.archetype }}</span>
                  <span
                    v-for="ability in unit.abilities"
                    :key="ability.name"
                    class="help__ability"
                    :title="ability.description"
                  >
                    {{ ability.name }}
                  </span>
                </td>
                <td v-for="(value, index) in unit.stats" :key="index" class="help__num">
                  {{ value }}
                </td>
                <td class="help__strong">{{ unit.strong }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>

      <template v-else-if="active === 'terrain'">
        <p class="help__text muted">{{ t('help.terrain.intro') }}</p>
        <table class="help__table">
          <thead>
            <tr>
              <th>{{ t('help.col.terrain') }}</th>
              <th class="help__num">{{ t('unit.movement') }}</th>
              <th class="help__num">{{ t('unit.defense') }}</th>
              <th class="help__num">{{ t('unit.attack') }}</th>
              <th>{{ t('help.col.notes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="terrain in terrains"
              :key="terrain.id"
              :data-test="`help-terrain-${terrain.id}`"
            >
              <td>
                <strong>{{ terrain.name }}</strong>
              </td>
              <td class="help__num">{{ terrain.move }}</td>
              <td class="help__num">{{ terrain.defense }}</td>
              <td class="help__num">{{ terrain.attack }}</td>
              <td class="muted">{{ terrain.notes }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <ShortcutList v-else />
    </div>
  </div>
</template>

<style scoped>
.help {
  display: grid;
  gap: 12px;
  min-height: 0;
}

.help__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  border-bottom: 1px solid var(--panel-border);
}

.help__tab {
  padding: 6px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--muted);
  font: inherit;
  cursor: pointer;
}

.help__tab:hover {
  color: var(--text);
}

.help__tab--active {
  border-bottom-color: var(--accent);
  color: var(--accent);
}

.help__body {
  display: grid;
  align-content: start;
  gap: 10px;
  max-height: min(60vh, 520px);
  overflow-y: auto;
  padding-right: 4px;
}

.help__text {
  margin: 0;
  line-height: 1.5;
}

.help__faction {
  display: grid;
  gap: 6px;
}

.help__faction h3 {
  font-size: 17px;
  color: var(--accent);
}

.help__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.help__table th {
  padding: 4px 6px;
  border-bottom: 1px solid var(--panel-border);
  color: var(--muted);
  font-weight: normal;
  text-align: left;
}

.help__table td {
  padding: 5px 6px;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  vertical-align: top;
}

.help__num {
  text-align: center !important;
  font-variant-numeric: tabular-nums;
}

.help__sub {
  display: block;
  font-size: 12px;
}

.help__ability {
  display: inline-block;
  margin: 2px 4px 0 0;
  padding: 0 6px;
  border-radius: 3px;
  background: rgb(217 180 90 / 15%);
  color: var(--accent);
  font-size: 11px;
  cursor: help;
}

.help__strong {
  font-size: 12px;
}
</style>
