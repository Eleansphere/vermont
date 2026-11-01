import type { CommandHandler, GameEvent, MoveUnitCommand } from '../command';
import { playerView } from '../fog';
import { disengagementStriker, resolveDisengagement } from '../combat';
import type { FieldedUnit } from '../unit';
import { isFighting, withUnits } from '../unit';
import { checkWalk, marchAlong } from '../unitMovement';
import { isRejection, orderedUnit } from './orders';

export const moveUnit: CommandHandler<MoveUnitCommand> = {
  phases: ['battle'],

  validate(state, command, defs) {
    const unit = orderedUnit(state, command.unitId);
    if (isRejection(unit)) return unit;
    if (!isPath(command.path)) {
      return { code: 'invalidPath', message: 'A path must be a list of hexes' };
    }
    // Checked against what the player knows: a refusal must not give hidden enemies away.
    const known = playerView(state, defs, unit.owner).state;
    const walk = checkWalk(known, defs, unit, command.path);
    return isRejection(walk) ? walk : null;
  },

  apply(state, command, defs) {
    const unit = orderedUnit(state, command.unitId);
    if (isRejection(unit)) throw new Error(unit.message);

    const march = marchAlong(state, defs, unit, command.path);
    const events: GameEvent[] = [];
    let before = state;
    let walker: FieldedUnit = unit;
    const striker = disengagementStriker(state, defs, unit, march.path);
    if (striker) {
      const struck = resolveDisengagement(state, defs, unit, striker);
      events.push(...struck.events);
      const after = struck.state.units[unit.id]!;
      // A unit the strike destroyed or broke does not go where it was sent.
      if (!isFighting(after)) return { state: struck.state, events };
      before = struck.state;
      walker = after;
    }

    const stopped = march.path.at(-1)!;
    const moved = {
      ...walker,
      pos: stopped,
      movementLeft:
        march.ambushed || march.endsInZoneOfControl ? 0 : walker.movementLeft - march.cost,
      movedThisTurn: walker.movedThisTurn + march.path.length - 1,
    };
    if (march.path.length > 1) {
      events.push({ type: 'UnitMoved', unitId: unit.id, path: march.path, cost: march.cost });
    }
    if (march.ambushed) events.push({ type: 'UnitAmbushed', unitId: unit.id, hex: stopped });
    return { state: withUnits(before, [moved]), events };
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
