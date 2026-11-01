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
  /**
   * Added to the damage multiplier of a hand-to-hand attack into the target's rear: a unit of
   * the attacker's side stands on the hex right behind the target, across from the attacker.
   */
  readonly rearBonus: number;
  /** Archetypes that leave an enemy's zone of control without being struck. */
  readonly freeDisengage: readonly Archetype[];
  /** Archetypes that charge when they attack hand to hand after a long enough move. */
  readonly chargers: readonly Archetype[];
  /** Hexes a unit must have moved in its turn before its attack counts as a charge. */
  readonly chargeDistance: number;
  /** Attack bonus of a charge. */
  readonly chargeAttack: number;
  /** Archetypes a charge breaks on: it brings no bonus against them. */
  readonly chargeStoppedBy: readonly Archetype[];
  /** Terrains a charge cannot be made into. */
  readonly chargeBlockedOn: readonly string[];
}

export interface MoraleRules {
  readonly max: number;
  /** At this morale or lower the unit is shaken. */
  readonly shakenAt: number;
  /** At this morale or lower the unit runs away. */
  readonly routingAt: number;
  /** Damage multiplier of a shaken unit. */
  readonly shakenAttackFactor: number;
  /** Lost by a unit for any hit, on top of what the damage costs. */
  readonly lossWhenHit: number;
  /** Every this many points of damage of a hit cost one more morale. */
  readonly damagePerMoraleLoss: number;
  /** A hit never costs less morale than this. */
  readonly minLossWhenHit: number;
  /** Taken off the loss of a unit hit with another unit of its side next to it. */
  readonly lineSupport: number;
  /** Lost on top of a hit into the unit's rear. */
  readonly lossWhenHitInRear: number;
  /** Lost on top of a hit by a charge. */
  readonly lossWhenCharged: number;
  /** Lost on top of `lossWhenHit` by a unit the hit leaves worn. */
  readonly lossWhenWorn: number;
  /** At this share of its full health or less a unit is worn. */
  readonly wornAt: number;
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

export interface VictoryRules {
  /**
   * An army breaks and loses once this share of the units it brought is destroyed or has fled
   * the field. Units still running across it do not count yet.
   */
  readonly armyBreaksAt: number;
}

export interface CommandRules {
  /** Hexes around the general within which units are in his command. */
  readonly range: number;
  /** Hexes around the general within which he leads units himself: their orders cost nothing. */
  readonly freeOrderRange: number;
  /** Taken off the morale a unit in command loses for a hit. */
  readonly moraleLossReduction: number;
  /** Added to the morale a unit in command regains at the start of its turn. */
  readonly recoveryBonus: number;
  /** Lost by every unit of an army whose general is destroyed or flees. */
  readonly moraleLostWithGeneral: number;
  /** Orders per turn an army loses with its general. */
  readonly ordersLostWithGeneral: number;
}

export interface FogRules {
  /** With the fog on, a player sees only what their units and camp see. */
  readonly enabled: boolean;
  /** How far a camp sees around itself. */
  readonly campSight: number;
}

export interface BattleRules {
  /** The battle is a draw when this many rounds were played and nobody won. */
  readonly roundLimit: number;
  readonly combat: CombatRules;
  readonly morale: MoraleRules;
  readonly victory: VictoryRules;
  readonly command: CommandRules;
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
  /** Orders each side may give in a turn; a side left out commands every unit every turn. */
  readonly orders: Readonly<Partial<Record<PlayerSlot, number>>>;
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
    orders: {},
    ...overrides,
  };
}
