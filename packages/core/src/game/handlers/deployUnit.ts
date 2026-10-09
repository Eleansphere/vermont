import type { BattleState } from '../battleState';
import type { CommandHandler, DeployUnitCommand, Rejection } from '../command';
import { checkDeployment } from '../deployment';
import type { Unit } from '../unit';
import { withUnits } from '../unit';
import { findUnit, isRejection } from './orders';

export const deployUnit: CommandHandler<DeployUnitCommand> = {
  phases: ['deployment'],

  validate(state, command, defs) {
    const unit = deployableUnit(state, command.unitId);
    if (isRejection(unit)) return unit;
    if (!isHex(command.hex)) {
      return { code: 'invalidHex', message: 'A unit is deployed on a hex with whole q and r' };
    }
    return checkDeployment(state, defs, unit, command.hex);
  },

  apply(state, command) {
    const unit = deployableUnit(state, command.unitId);
    if (isRejection(unit)) throw new Error(unit.message);

    const hex = { q: command.hex.q, r: command.hex.r };
    const deployed: Unit = { ...unit, pos: hex, status: 'active' };
    return {
      state: withUnits(state, [deployed]),
      events: [{ type: 'UnitDeployed', unitId: unit.id, hex, from: unit.pos }],
    };
  },
};

/** The unit the active player wants to deploy, or the reason it is not theirs to deploy. */
function deployableUnit(state: BattleState, unitId: string): Unit | Rejection {
  const unit = findUnit(state, unitId);
  if (!unit) {
    return { code: 'unknownUnit', message: `Unknown unit: ${JSON.stringify(unitId)}` };
  }
  if (unit.owner !== state.activePlayer) {
    return { code: 'notYourUnit', message: `Unit "${unit.id}" belongs to the other player` };
  }
  return unit;
}

/** Commands can arrive from a save file or over the wire, so the shape is checked at run time. */
function isHex(hex: { q?: unknown; r?: unknown } | null): boolean {
  return Number.isInteger(hex?.q) && Number.isInteger(hex?.r);
}
