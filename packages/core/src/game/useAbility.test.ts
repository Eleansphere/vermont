import { describe, expect, it } from 'vitest';
import { hex } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import type { Command } from './command';
import { battleWith, place, play, rejectionOf, unitOf } from './testSupport';
import type { UnitPlacement } from './unit';

function relieve(unitId: string, targetId?: string): Command {
  return { type: 'UseAbility', unitId, abilityId: 'lineRelief', targetId };
}

/** Hastati in the line facing the Gauls, principes right behind them. */
function line(...others: UnitPlacement[]) {
  return battleWith([
    place('principes', 'principes', 0, 0, 0),
    place('hastati', 'hastati', 0, 1, 0),
    place('gauls', 'gallic-mercenaries', 1, 2, 0),
    ...others,
  ]);
}

describe('line relief', () => {
  it('swaps the unit with a neighbour of its side', () => {
    const after = play(line(), relieve('principes', 'hastati'));

    expect(unitOf(after, 'principes').pos).toEqual(hex(1, 0));
    expect(unitOf(after, 'hastati').pos).toEqual(hex(0, 0));
    expect(after.events).toEqual([
      { type: 'UnitsSwapped', unitId: 'principes', targetId: 'hastati' },
    ]);
  });

  it('uses up the movement of the relieving unit but lets it attack', () => {
    const after = play(line(), relieve('principes', 'hastati'));

    expect(unitOf(after, 'principes')).toMatchObject({ movementLeft: 0, hasAttacked: false });
    expect(unitOf(after, 'hastati').movementLeft).toBe(4);
    expect(rejectionOf(after, relieve('principes', 'hastati'))).toBe('abilityUnavailable');
    expect(
      rejectionOf(after, { type: 'Attack', unitId: 'principes', targetId: 'gauls' })
    ).toBeNull();
  });

  it('is not possible after the unit has attacked', () => {
    const battle = line(place('numidians', 'numidian-cavalry', 1, -1, 0));
    const after = play(battle, { type: 'Attack', unitId: 'principes', targetId: 'numidians' });

    expect(rejectionOf(after, relieve('principes', 'hastati'))).toBe('abilityUnavailable');
  });

  it('belongs only to units that have the ability', () => {
    expect(rejectionOf(line(), relieve('hastati', 'principes'))).toBe('abilityUnavailable');
    expect(
      rejectionOf(line(), {
        type: 'UseAbility',
        unitId: 'principes',
        abilityId: 'pilum',
        targetId: 'hastati',
      })
    ).toBe('abilityUnavailable');
  });

  it('needs a neighbouring unit of its own side that still fights', () => {
    const battle = line(
      place('triarii', 'triarii', 0, -2, 0),
      place('near', 'gallic-mercenaries', 1, 0, 1)
    );

    expect(rejectionOf(battle, relieve('principes', 'triarii'))).toBe('invalidTarget');
    expect(rejectionOf(battle, relieve('principes', 'near'))).toBe('invalidTarget');
    expect(rejectionOf(battle, relieve('principes', 'nobody'))).toBe('invalidTarget');
    expect(rejectionOf(battle, relieve('principes'))).toBe('invalidTarget');
    expect(rejectionOf(battle, relieve('principes', 'principes'))).toBe('invalidTarget');
  });

  it('does not put a unit on terrain it cannot enter', () => {
    const map = paintTerrain(createMap('pass', hexagonHexes(3)), 'mountain', [hex(0, 0)]);
    const battle = battleWith(
      [place('principes', 'principes', 0, 0, 0), place('equites', 'equites', 0, 1, 0)],
      { map }
    );

    expect(rejectionOf(battle, relieve('principes', 'equites'))).toBe('impassable');
  });
});
