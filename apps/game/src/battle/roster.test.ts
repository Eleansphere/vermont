import { describe, expect, it } from 'vitest';
import { SCENARIOS, autoDeployment, dispatchAll, fieldedUnits, startScenario } from '@vermont/core';
import { campDistance } from './labels';
import { armyRoster } from './roster';

function deployedTrebia() {
  const { state: start, defs } = startScenario(SCENARIOS.trebia!, 1);
  let state = start;
  while (state.phase === 'deployment') {
    const result = dispatchAll(
      state,
      [...autoDeployment(state, defs), { type: 'EndDeployment' }],
      defs
    );
    if (!result.ok) throw new Error(result.rejection.message);
    state = result.state;
  }
  return { state, defs };
}

describe('army roster', () => {
  it('lists the units of one side on the field, kind by kind and by number', () => {
    const { state, defs } = deployedTrebia();

    const roster = armyRoster(state, defs, 0);

    expect(roster).toHaveLength(fieldedUnits(state, 0).length);
    const order = Object.keys(defs.unitTypes);
    const kinds = roster.map((entry) => order.indexOf(state.units[entry.id]!.typeId));
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));
    const hastati = roster.filter((entry) => entry.label.startsWith('Hastati'));
    expect(hastati.map((entry) => entry.label)).toEqual(
      hastati.map((_, index) => `Hastati ${index + 1}`)
    );
  });

  it('tells the principes from the hastati by a pip', () => {
    const { state, defs } = deployedTrebia();

    const roster = armyRoster(state, defs, 0);

    const iconOf = (name: string) => roster.find((entry) => entry.label.startsWith(name))!.icon;
    expect(iconOf('Hastati')).toEqual({ archetype: 'heavyInfantry', pips: 0 });
    expect(iconOf('Principes')).toEqual({ archetype: 'heavyInfantry', pips: 1 });
  });
});

describe('camp distance', () => {
  it('measures from the nearest unit still fighting to the enemy camp', () => {
    const { state, defs } = deployedTrebia();
    const camp = defs.camps[1]!;

    const nearest = Math.min(
      ...fieldedUnits(state, 0).map(
        (unit) =>
          (Math.abs(unit.pos.q - camp.q) +
            Math.abs(unit.pos.r - camp.r) +
            Math.abs(unit.pos.q + unit.pos.r - camp.q - camp.r)) /
          2
      )
    );

    expect(campDistance(state, defs, 0)).toBe(nearest);
    expect(campDistance(state, { ...defs, camps: {} }, 0)).toBeNull();
  });
});
