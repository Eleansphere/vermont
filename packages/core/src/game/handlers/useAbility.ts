import { hexDistance } from '../../hex/hex';
import { terrainAt } from '../../map/battleMap';
import { terrainMoveCost } from '../../map/terrain';
import type { BattleState } from '../battleState';
import type { CommandHandler, Rejection, UseAbilityCommand } from '../command';
import type { BattleDefs } from '../rules';
import type { FieldedUnit } from '../unit';
import { abilityOf, isFighting, unitTypeOf, withUnits } from '../unit';
import { findUnit, isRejection, orderedUnit } from './orders';

interface OrderedSwap {
  readonly unit: FieldedUnit;
  readonly partner: FieldedUnit;
}

/** Abilities that have to be ordered. For now that is only `lineRelief`. */
export const useAbility: CommandHandler<UseAbilityCommand> = {
  phases: ['battle'],

  validate(state, command, defs) {
    const swap = checkLineRelief(state, command, defs);
    return isRejection(swap) ? swap : null;
  },

  apply(state, command, defs) {
    const swap = checkLineRelief(state, command, defs);
    if (isRejection(swap)) throw new Error(swap.message);
    const { unit, partner } = swap;

    // Stepping into the line takes the rest of the unit's movement; it may still attack.
    const relieving = { ...unit, pos: partner.pos, movementLeft: 0 };
    const relieved = { ...partner, pos: unit.pos };
    return {
      state: withUnits(state, [relieving, relieved]),
      events: [{ type: 'UnitsSwapped', unitId: unit.id, targetId: partner.id }],
    };
  },
};

function checkLineRelief(
  state: BattleState,
  command: UseAbilityCommand,
  defs: BattleDefs
): OrderedSwap | Rejection {
  const unit = orderedUnit(state, command.unitId);
  if (isRejection(unit)) return unit;
  if (command.abilityId !== 'lineRelief' || !abilityOf(defs, unit, 'lineRelief')) {
    return unavailable(
      `Unit "${unit.id}" has no ability ${JSON.stringify(command.abilityId)} to use`
    );
  }
  if (unit.hasAttacked || unit.movementLeft <= 0) {
    return unavailable(`Unit "${unit.id}" has no movement left to change places`);
  }
  const partner = command.targetId === undefined ? undefined : findUnit(state, command.targetId);
  if (
    !partner ||
    !isFighting(partner) ||
    partner.owner !== unit.owner ||
    hexDistance(partner.pos, unit.pos) !== 1
  ) {
    return {
      code: 'invalidTarget',
      message: `Unit "${unit.id}" can only change places with a neighbouring unit of its side`,
    };
  }
  if (!canStandOn(defs, unit, partner) || !canStandOn(defs, partner, unit)) {
    return { code: 'impassable', message: 'One of the units cannot enter the hex of the other' };
  }
  return { unit, partner };
}

function canStandOn(defs: BattleDefs, unit: FieldedUnit, other: FieldedUnit): boolean {
  const terrain = terrainAt(defs.map, defs.terrains, other.pos);
  return !!terrain && terrainMoveCost(terrain, unitTypeOf(defs, unit).archetype) !== null;
}

function unavailable(message: string): Rejection {
  return { code: 'abilityUnavailable', message };
}
