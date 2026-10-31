import type { BattleState, GameEvent, Hex } from '@vermont/core';
import { isFielded } from '@vermont/core';

/**
 * Where the camera should look to see what the events show: the unit struck by an attack,
 * or else where a march ends. `null` when nothing happened on the map.
 */
export function eventFocus(events: readonly GameEvent[], state: BattleState): Hex | null {
  const placeOf = (unitId: string): Hex | null => {
    const unit = state.units[unitId];
    return unit && isFielded(unit) ? unit.pos : null;
  };
  for (const event of events) {
    if (event.type === 'AttackResolved' || event.type === 'UnitRampaged') {
      const place =
        placeOf(event.targetId) ??
        placeOf(event.type === 'AttackResolved' ? event.attackerId : event.unitId);
      if (place) return place;
    }
  }
  for (const event of [...events].reverse()) {
    if (event.type === 'UnitMoved' && event.path.length > 1) return event.path.at(-1)!;
  }
  return null;
}
