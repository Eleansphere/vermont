import { describe, expect, it } from 'vitest';
import { SCENARIOS, autoDeployment, dispatchAll, fieldedUnits, startScenario } from '@vermont/core';
import { eventFocus } from './focus';

const { state: start, defs } = startScenario(SCENARIOS.trebia!, 1);
let state = start;
while (state.phase === 'deployment') {
  state = dispatchAll(
    state,
    [...autoDeployment(state, defs), { type: 'EndDeployment' }],
    defs
  ).state;
}

describe('eventFocus', () => {
  it('looks at the unit struck by an attack', () => {
    const [attacker] = fieldedUnits(state, 0);
    const [target] = fieldedUnits(state, 1);

    expect(
      eventFocus(
        [
          { type: 'UnitMoved', unitId: attacker!.id, path: [attacker!.pos, target!.pos], cost: 1 },
          {
            type: 'AttackResolved',
            attackerId: attacker!.id,
            targetId: target!.id,
            kind: 'melee',
            damage: 2,
            counterDamage: 1,
          },
        ],
        state
      )
    ).toEqual(target!.pos);
  });

  it('looks where a march ends, and nowhere when nothing happened on the map', () => {
    const [unit] = fieldedUnits(state, 1);
    const end = { q: 3, r: 4 };

    expect(
      eventFocus([{ type: 'UnitMoved', unitId: unit!.id, path: [unit!.pos, end], cost: 1 }], state)
    ).toEqual(end);
    expect(eventFocus([{ type: 'TurnEnded', player: 1, turn: 1 }], state)).toBeNull();
  });
});
