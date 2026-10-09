import type { Hex, HexKey } from '../hex/hex';
import { hexDistance, hexKey } from '../hex/hex';
import type { AbilityDef, AbilityId, UnitTypeDef, UnitTypeTable } from '../units/unitType';
import type { BattleState, PlayerSlot } from './battleState';
import type { BattleDefs, MoraleRules } from './rules';

export type MoraleState = 'steady' | 'shaken' | 'routing';

export const MORALE_STATES: readonly MoraleState[] = ['steady', 'shaken', 'routing'];

/**
 * `reserve` units wait to be deployed before the battle. `fled` units left the battlefield and
 * `dead` ones were destroyed; neither comes back.
 */
export type UnitStatus = 'reserve' | 'active' | 'fled' | 'dead';

export const UNIT_STATUSES: readonly UnitStatus[] = ['reserve', 'active', 'fled', 'dead'];

/** One unit in a battle: what changes about it. The rest is in its `UnitTypeDef`. */
export interface Unit {
  readonly id: string;
  readonly typeId: string;
  readonly owner: PlayerSlot;
  /** `null` while the unit is not on the battlefield: not deployed yet, or gone from it. */
  readonly pos: Hex | null;
  readonly hp: number;
  readonly morale: number;
  readonly moraleState: MoraleState;
  readonly movementLeft: number;
  readonly hasAttacked: boolean;
  readonly status: UnitStatus;
  /** A routing unit that has already made its retreat; next it rallies or leaves the field. */
  readonly hasRetreated: boolean;
  /** One-off abilities the unit has used up. */
  readonly spentAbilities: readonly AbilityId[];
}

/** A unit that is on the battlefield. */
export type FieldedUnit = Unit & { readonly pos: Hex };

/** A unit of some type that starts the battle, and where. */
export interface UnitPlacement {
  readonly typeId: string;
  readonly owner: PlayerSlot;
  /** Left out for a unit its player deploys before the battle. */
  readonly pos?: Hex;
  /** Generated from the owner and type when left out. */
  readonly id?: string;
}

/** Fresh units for the start of a battle, at full health and morale; ids count up per type. */
export function createUnits(
  unitTypes: UnitTypeTable,
  rules: MoraleRules,
  placements: readonly UnitPlacement[]
): Unit[] {
  const countByPrefix = new Map<string, number>();
  return placements.map((placement) => {
    const type = unitTypes[placement.typeId];
    if (!type) throw new Error(`Unknown unit type: "${placement.typeId}"`);

    const prefix = `p${placement.owner}-${type.id}`;
    const count = (countByPrefix.get(prefix) ?? 0) + 1;
    countByPrefix.set(prefix, count);

    return {
      id: placement.id ?? `${prefix}-${count}`,
      typeId: type.id,
      owner: placement.owner,
      pos: placement.pos ?? null,
      hp: type.hp,
      morale: type.morale,
      moraleState: moraleStateOf(type.morale, rules),
      movementLeft: type.movement,
      hasAttacked: false,
      status: placement.pos ? 'active' : 'reserve',
      hasRetreated: false,
      spentAbilities: [],
    };
  });
}

export function moraleStateOf(morale: number, rules: MoraleRules): MoraleState {
  if (morale <= rules.routingAt) return 'routing';
  if (morale <= rules.shakenAt) return 'shaken';
  return 'steady';
}

export function isFielded(unit: Unit): unit is FieldedUnit {
  return unit.status === 'active' && unit.pos !== null;
}

/** Whether the unit still fights: on the field and not running away. */
export function isFighting(unit: Unit): unit is FieldedUnit {
  return isFielded(unit) && unit.moraleState !== 'routing';
}

export function fieldedUnits(state: BattleState, owner?: PlayerSlot): FieldedUnit[] {
  return Object.values(state.units).filter(
    (unit): unit is FieldedUnit => isFielded(unit) && (owner === undefined || unit.owner === owner)
  );
}

export function unitAt(state: BattleState, target: Hex): FieldedUnit | undefined {
  return fieldedUnits(state).find((unit) => hexDistance(unit.pos, target) === 0);
}

export function unitHexes(units: readonly FieldedUnit[]): Set<HexKey> {
  return new Set(units.map((unit) => hexKey(unit.pos)));
}

/** Units of `owner` on the hexes next to `target`. */
export function adjacentUnits(state: BattleState, target: Hex, owner: PlayerSlot): FieldedUnit[] {
  return fieldedUnits(state, owner).filter((unit) => hexDistance(unit.pos, target) === 1);
}

export function unitTypeOf(defs: BattleDefs, unit: Unit): UnitTypeDef {
  const type = defs.unitTypes[unit.typeId];
  if (!type) throw new Error(`Unit "${unit.id}" has unknown type "${unit.typeId}"`);
  return type;
}

/** The ability as the unit has it, or `undefined` when its type does not have it. */
export function abilityOf(
  defs: BattleDefs,
  unit: Unit,
  abilityId: AbilityId
): AbilityDef | undefined {
  return unitTypeOf(defs, unit).abilities.includes(abilityId)
    ? defs.abilities[abilityId]
    : undefined;
}

/** A copy of the state with the given units replaced. */
export function withUnits(state: BattleState, changed: readonly Unit[]): BattleState {
  const units = { ...state.units };
  for (const unit of changed) units[unit.id] = unit;
  return { ...state, units };
}
