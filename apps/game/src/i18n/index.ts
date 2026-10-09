import type {
  AbilityId,
  Archetype,
  FactionDef,
  MoraleState,
  RejectionCode,
  ScenarioDef,
  TerrainId,
  UnitTypeDef,
  VictoryReason,
} from '@vermont/core';
import type { AbilityText, PluralForms, PluralKey, UiKey } from './cs';
import { cs } from './cs';

export type { UiKey } from './cs';

/** The language in use. Czech is the only one for now. */
const messages = cs;

export type TextParams = Readonly<Record<string, string | number>>;

/** The text for `key` with its `{placeholders}` filled in. */
export function t(key: UiKey, params: TextParams = {}): string {
  return messages.ui[key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder
  );
}

const FEW_FROM = 2;
const FEW_TO = 4;

/** The word for `count` things, without the number. */
export function plural(key: PluralKey, count: number): string {
  const forms: PluralForms = messages.plurals[key];
  if (count === 1) return forms[0];
  return count >= FEW_FROM && count <= FEW_TO ? forms[1] : forms[2];
}

function named(names: Readonly<Record<string, string>>, def: { id: string; name: string }): string {
  return Object.hasOwn(names, def.id) ? names[def.id]! : def.name;
}

export const factionName = (faction: FactionDef): string => named(messages.factions, faction);
export const scenarioName = (scenario: ScenarioDef): string => named(messages.scenarios, scenario);
export const unitTypeName = (type: UnitTypeDef): string => named(messages.unitTypes, type);
export const archetypeName = (archetype: Archetype): string => messages.archetypes[archetype];
export const terrainName = (terrain: TerrainId): string => messages.terrains[terrain];
export const abilityText = (ability: AbilityId): AbilityText => messages.abilities[ability];
export const moraleStateName = (state: MoraleState): string => messages.moraleStates[state];
export const victoryReasonText = (reason: VictoryReason): string => messages.victoryReasons[reason];
export const rejectionText = (code: RejectionCode): string => messages.rejections[code];
