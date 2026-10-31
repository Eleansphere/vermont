import {
  FACTIONS,
  fieldedUnits,
  hexDistance,
  isFielded,
  isFighting,
  opponentOf,
  unitTypeOf,
} from '@vermont/core';
import type { BattleDefs, BattleState, PlayerSlot, ScenarioDef, Unit } from '@vermont/core';
// From the palette alone, so the menu does not pull in Three.js.
import { PLAYER_COLORS } from '@vermont/render/palette';
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

/** What a battle cost each side, for the result screen. */
export interface BattleSummary {
  readonly player: PlayerSlot;
  readonly dead: number;
  readonly fled: number;
  /** Units still on the field at the end. */
  readonly standing: number;
  readonly total: number;
}

export function battleSummary(state: BattleState, player: PlayerSlot): BattleSummary {
  const army = Object.values(state.units).filter((unit) => unit.owner === player);
  const count = (status: Unit['status']) => army.filter((unit) => unit.status === status).length;
  return {
    player,
    dead: count('dead'),
    fled: count('fled'),
    standing: count('active'),
    total: army.length,
  };
}

/**
 * How far the side's nearest unit still in the fight is from the opponent's camp, in hexes;
 * `null` when the opponent has no camp or the side has nobody to send.
 */
export function campDistance(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): number | null {
  const camp = defs.camps[opponentOf(player)];
  if (!camp) return null;
  const distances = fieldedUnits(state, player)
    .filter(isFighting)
    .map((unit) => hexDistance(unit.pos, camp));
  return distances.length > 0 ? Math.min(...distances) : null;
}
