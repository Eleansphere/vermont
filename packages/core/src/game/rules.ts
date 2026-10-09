import type { Archetype } from '../archetype';
import { ABILITIES } from '../data/abilities';
import { RULES } from '../data/rules';
import { TERRAINS } from '../data/terrains';
import { UNIT_TYPES } from '../data/unitTypes';
import type { Hex } from '../hex/hex';
import type { BattleMapDef } from '../map/battleMap';
import type { TerrainTable } from '../map/terrain';
import type { AbilityTable, UnitTypeTable } from '../units/unitType';
import type { PlayerSlot } from './battleState';

export interface CombatRules {
  /** Damage of a strike whose attack equals the target's defence. */
  readonly baseDamage: number;
  /** Random spread of damage to either side: 0.1 means 90 to 110 %. */
  readonly damageSpread: number;
  /** An attack always does at least this much; a counter-attack may do nothing. */
  readonly minAttackDamage: number;
  /** Strength of the defender's counter-attack compared with an attack. */
  readonly counterFactor: number;
  /** Share of its strength a unit keeps when almost destroyed; at full health it has all of it. */
  readonly woundedFloor: number;
  /** Damage multiplier against the archetypes listed in `advantages`. */
  readonly advantageFactor: number;
  /** Archetypes each archetype is strong against. */
  readonly advantages: Readonly<Record<Archetype, readonly Archetype[]>>;
  /** Added to the damage multiplier for each further unit of the striker's side next to the target. */
  readonly flankBonus: number;
  /** Attack bonus for striking from a hill at a target on lower ground. */
  readonly downhillAttack: number;
  /** Attack change for a unit standing on terrain that hinders its archetype. */
  readonly hinderedAttack: number;
}

export interface MoraleRules {
  readonly max: number;
  /** At this morale or lower the unit is shaken. */
  readonly shakenAt: number;
  /** At this morale or lower the unit runs away. */
  readonly routingAt: number;
  /** Damage multiplier of a shaken unit. */
  readonly shakenAttackFactor: number;
  readonly lossWhenHit: number;
  /** Lost on top of `lossWhenHit` by a unit hit while encircled. */
  readonly lossWhenEncircled: number;
  /** Enemy units next to a unit that make it encircled. */
  readonly encircledAt: number;
  /** Lost by units next to a unit of their side that was destroyed. */
  readonly lossWhenAllyDies: number;
  /** Gained by an attacker that did more damage than it took. */
  readonly gainForWonAttack: number;
  /** Regained at the start of its turn by a unit with no enemy next to it. */
  readonly recoveryPerTurn: number;
}

export interface FogRules {
  /** With the fog on, a player sees only what their units and camp see. */
  readonly enabled: boolean;
  /** How far a camp sees around itself. */
  readonly campSight: number;
}

export interface BattleRules {
  readonly combat: CombatRules;
  readonly morale: MoraleRules;
  readonly fog: FogRules;
}

/**
 * Everything a battle is played with that does not change while it lasts. The state only
 * refers to it (unit types by id, hexes by coordinate), so it has to be passed along with it.
 */
export interface BattleDefs {
  readonly map: BattleMapDef;
  readonly terrains: TerrainTable;
  readonly unitTypes: UnitTypeTable;
  readonly abilities: AbilityTable;
  readonly rules: BattleRules;
  /** Camp of each side; the battle is won by whoever enters the opponent's. */
  readonly camps: Readonly<Partial<Record<PlayerSlot, Hex>>>;
  /** Hexes each side may deploy its units on before the battle. */
  readonly deploymentZones: Readonly<Partial<Record<PlayerSlot, readonly Hex[]>>>;
}

/** Definitions for a battle on `map` with the standard terrains, unit types and rules. */
export function createDefs(
  map: BattleMapDef,
  overrides: Partial<Omit<BattleDefs, 'map'>> = {}
): BattleDefs {
  return {
    map,
    terrains: TERRAINS,
    unitTypes: UNIT_TYPES,
    abilities: ABILITIES,
    rules: RULES,
    camps: {},
    deploymentZones: {},
    ...overrides,
  };
}
