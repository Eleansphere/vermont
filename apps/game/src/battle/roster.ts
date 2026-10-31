import type { BattleDefs, BattleState, MoraleState, PlayerSlot } from '@vermont/core';
import { fieldedUnits, unitTypeOf } from '@vermont/core';
import type { UnitIcon } from '@vermont/render/icons';
import { unitIcon } from '@vermont/render/icons';
import { unitLabel } from './labels';

/** One unit in the army bar. */
export interface RosterEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: UnitIcon;
  readonly hp: number;
  readonly maxHp: number;
  readonly morale: number;
  readonly maxMorale: number;
  readonly moraleState: MoraleState;
}

/**
 * The side's units on the field in the order of the army bar: by kind as the unit table lists
 * them, then by number, so a unit keeps its place in the bar for the whole battle.
 */
export function armyRoster(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): RosterEntry[] {
  const typeOrder = Object.keys(defs.unitTypes);
  return fieldedUnits(state, player)
    .map((unit) => {
      const type = unitTypeOf(defs, unit);
      return {
        id: unit.id,
        label: unitLabel(state, defs, unit),
        icon: unitIcon(defs.unitTypes, type),
        hp: unit.hp,
        maxHp: type.hp,
        morale: unit.morale,
        maxMorale: defs.rules.morale.max,
        moraleState: unit.moraleState,
        order: typeOrder.indexOf(type.id),
      };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'cs', { numeric: true }))
    .map(({ order: _order, ...entry }) => entry);
}
