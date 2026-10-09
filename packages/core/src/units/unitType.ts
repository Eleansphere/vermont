import type { Archetype } from '../archetype';

export type AbilityId =
  'pilum' | 'lineRelief' | 'shieldWall' | 'furiousCharge' | 'hitAndRun' | 'fear';

/**
 * A special rule some unit types have. What the ability does is written in the rules; the
 * numbers it works with live here, so balancing never touches the code.
 */
export interface AbilityDef {
  readonly id: AbilityId;
  /** `passive` always applies, `triggered` fires on its own at some moment, `active` is ordered. */
  readonly kind: 'passive' | 'triggered' | 'active';
  readonly params: Readonly<Record<string, number>>;
  /** Archetypes the ability works against; left out when it works against everybody. */
  readonly against?: readonly Archetype[];
}

export type AbilityTable = Readonly<Record<AbilityId, AbilityDef>>;

/** One kind of unit: everything about it that does not change during a battle. */
export interface UnitTypeDef {
  readonly id: string;
  readonly factionId: string;
  readonly name: string;
  readonly archetype: Archetype;
  readonly attack: number;
  readonly defense: number;
  readonly hp: number;
  /** Movement points the unit gets every turn. */
  readonly movement: number;
  /** How many hexes the unit sees. */
  readonly sight: number;
  /** How many hexes the unit shoots; left out for units that fight only hand to hand. */
  readonly range?: number;
  /** Morale the unit starts with and recovers up to. */
  readonly morale: number;
  readonly abilities: readonly AbilityId[];
}

export type UnitTypeTable = Readonly<Record<string, UnitTypeDef>>;
