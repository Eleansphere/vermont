import { FACTIONS, isFielded, isFighting, unitTypeOf } from '@vermont/core';
import type { BattleDefs, BattleState, PlayerSlot, ScenarioDef, Unit } from '@vermont/core';
import { PLAYER_COLORS } from '@vermont/render';
import { factionName, unitTypeName } from '../i18n';

/** The name of the side that plays in the slot: its faction. */
export function sideName(scenario: ScenarioDef, player: PlayerSlot): string {
  const { factionId } = scenario.sides[player];
  const faction = Object.hasOwn(FACTIONS, factionId) ? FACTIONS[factionId] : undefined;
  return faction ? factionName(faction) : factionId;
}

/** The side's colour as CSS, the same one its units have on the map. */
export function sideColor(player: PlayerSlot): string {
  return `#${PLAYER_COLORS[player].toString(16).padStart(6, '0')}`;
}

/**
 * What the unit is called in the interface: its type, numbered when its side has more of them
 * ("Hastati 2").
 */
export function unitLabel(state: BattleState, defs: BattleDefs, unit: Unit): string {
  const name = unitTypeName(unitTypeOf(defs, unit));
  const siblings = Object.values(state.units).filter(
    (other) => other.owner === unit.owner && other.typeId === unit.typeId
  );
  if (siblings.length < 2) return name;
  return `${name} ${siblings.findIndex((other) => other.id === unit.id) + 1}`;
}

/** How one side's army is doing, for the bar at the top. */
export interface ArmyStatus {
  readonly total: number;
  /** Units on the field that still take orders. */
  readonly fighting: number;
  readonly routing: number;
  /** Health of the units on the field as a share of the health the whole army started with. */
  readonly strength: number;
}

export function armyStatus(state: BattleState, defs: BattleDefs, player: PlayerSlot): ArmyStatus {
  const army = Object.values(state.units).filter((unit) => unit.owner === player);
  const present = army.filter((unit) => isFielded(unit) || unit.status === 'reserve');
  const fullHealth = army.reduce((sum, unit) => sum + unitTypeOf(defs, unit).hp, 0);
  const health = present.reduce((sum, unit) => sum + unit.hp, 0);
  return {
    total: army.length,
    fighting: present.filter((unit) => unit.status === 'reserve' || isFighting(unit)).length,
    routing: present.filter((unit) => unit.moraleState === 'routing').length,
    strength: fullHealth > 0 ? health / fullHealth : 0,
  };
}
