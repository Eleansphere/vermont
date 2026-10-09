import type { BattleState } from '../battleState';
import { attackKindFor, resolveAttack } from '../combat';
import type { AttackCommand, AttackKind, CommandHandler, Rejection } from '../command';
import { seesUnit } from '../fog';
import type { BattleDefs } from '../rules';
import type { FieldedUnit } from '../unit';
import { isFielded } from '../unit';
import { findUnit, isRejection, orderedUnit } from './orders';

interface OrderedAttack {
  readonly attacker: FieldedUnit;
  readonly target: FieldedUnit;
  readonly kind: AttackKind;
}

export const attack: CommandHandler<AttackCommand> = {
  phases: ['battle'],

  validate(state, command, defs) {
    const ordered = checkAttack(state, command, defs);
    return isRejection(ordered) ? ordered : null;
  },

  apply(state, command, defs) {
    const ordered = checkAttack(state, command, defs);
    if (isRejection(ordered)) throw new Error(ordered.message);
    return resolveAttack(state, defs, ordered.attacker, ordered.target, ordered.kind);
  },
};

function checkAttack(
  state: BattleState,
  command: AttackCommand,
  defs: BattleDefs
): OrderedAttack | Rejection {
  const attacker = orderedUnit(state, command.unitId);
  if (isRejection(attacker)) return attacker;
  if (attacker.hasAttacked) {
    return {
      code: 'alreadyAttacked',
      message: `Unit "${attacker.id}" has already attacked this turn`,
    };
  }
  const target = findUnit(state, command.targetId);
  // A unit hidden in the fog is refused like one that is not there, so asking gives nothing away.
  if (!target || !isFielded(target) || !seesUnit(state, defs, attacker.owner, target)) {
    return {
      code: 'invalidTarget',
      message: `There is no unit ${JSON.stringify(command.targetId)} on the battlefield`,
    };
  }
  const kind = attackKindFor(state, defs, attacker, target);
  return typeof kind === 'string' ? { attacker, target, kind } : kind;
}
