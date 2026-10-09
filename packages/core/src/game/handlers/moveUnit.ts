import type { CommandHandler, MoveUnitCommand } from '../command';
import { withUnits } from '../unit';
import { checkWalk } from '../unitMovement';
import { isRejection, orderedUnit } from './orders';

export const moveUnit: CommandHandler<MoveUnitCommand> = {
  phases: ['battle'],

  validate(state, command, defs) {
    const unit = orderedUnit(state, command.unitId);
    if (isRejection(unit)) return unit;
    if (!isPath(command.path)) {
      return { code: 'invalidPath', message: 'A path must be a list of hexes' };
    }
    const walk = checkWalk(state, defs, unit, command.path);
    return isRejection(walk) ? walk : null;
  },

  apply(state, command, defs) {
    const unit = orderedUnit(state, command.unitId);
    if (isRejection(unit)) throw new Error(unit.message);
    const walk = checkWalk(state, defs, unit, command.path);
    if (isRejection(walk)) throw new Error(walk.message);

    const moved = {
      ...unit,
      pos: command.path.at(-1)!,
      movementLeft: walk.endsInZoneOfControl ? 0 : unit.movementLeft - walk.cost,
    };
    return {
      state: withUnits(state, [moved]),
      events: [{ type: 'UnitMoved', unitId: unit.id, path: [...command.path], cost: walk.cost }],
    };
  },
};

/** Commands can arrive from a save file or over the wire, so the shape is checked at run time. */
function isPath(path: unknown): boolean {
  return (
    Array.isArray(path) &&
    path.every(
      (step: { q?: unknown; r?: unknown } | null) =>
        Number.isInteger(step?.q) && Number.isInteger(step?.r)
    )
  );
}
