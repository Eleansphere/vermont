import { describe, expect, it } from 'vitest';
import type { Hex } from '../hex/hex';
import { hex } from '../hex/hex';
import type { Command } from './command';
import { ordersLeft, ordersPerTurn } from './generals';
import type { BattleRules } from './rules';
import type { TestBattle } from './testSupport';
import {
  END_TURN,
  EXACT_RULES,
  battleWith,
  place,
  play,
  rejectionOf,
  unitOf,
  withUnit,
} from './testSupport';
import type { UnitPlacement } from './unit';
import { armyLosses } from './victory';

const move = (unitId: string, ...path: Hex[]): Command => ({ type: 'MoveUnit', unitId, path });
const attack = (unitId: string, targetId: string): Command => ({
  type: 'Attack',
  unitId,
  targetId,
});

/** A battle in which Rome may give `orders` orders a turn and Carthage as many as it likes. */
function commanded(
  orders: number,
  placements: readonly UnitPlacement[],
  rules: BattleRules = EXACT_RULES
): TestBattle {
  const battle = battleWith(placements, { rules });
  return { ...battle, defs: { ...battle.defs, orders: { 0: orders } } };
}

describe('orders', () => {
  const army = () =>
    commanded(2, [
      place('consul', 'consul', 0, -4, 0),
      place('near', 'hastati', 0, -4, 1),
      place('first', 'hastati', 0, 2, -4),
      place('second', 'hastati', 0, 3, -4),
      place('third', 'hastati', 0, 4, -4),
      place('foe', 'hastati', 1, 0, 4),
    ]);

  it('lets the side order only so many units a turn', () => {
    const battle = army();
    const spent = play(
      battle,
      move('first', hex(2, -4), hex(2, -3)),
      move('second', hex(3, -4), hex(3, -3))
    );

    expect(ordersLeft(battle.state, battle.defs)).toBe(2);
    expect(ordersLeft(spent.state, spent.defs)).toBe(0);
    expect(rejectionOf(spent, move('third', hex(4, -4), hex(4, -3)))).toBe('noOrders');
    // A unit that has its order does the rest of its turn without another.
    expect(rejectionOf(spent, move('first', hex(2, -3), hex(2, -2)))).toBeNull();
  });

  it('costs nothing for the general and the units he leads himself', () => {
    const after = play(
      army(),
      move('consul', hex(-4, 0), hex(-3, 0)),
      move('near', hex(-4, 1), hex(-4, 2))
    );

    expect(ordersLeft(after.state, after.defs)).toBe(2);
    expect(unitOf(after, 'near').ordered).toBe(true);
  });

  it('come back in full at the start of the next turn', () => {
    const spent = play(
      army(),
      move('first', hex(2, -4), hex(2, -3)),
      move('second', hex(3, -4), hex(3, -3)),
      END_TURN,
      END_TURN
    );

    expect(ordersLeft(spent.state, spent.defs)).toBe(2);
    expect(unitOf(spent, 'first').ordered).toBe(false);
    expect(rejectionOf(spent, move('third', hex(4, -4), hex(4, -3)))).toBeNull();
  });

  it('do not limit a side the battle gives no number of orders', () => {
    const battle = army();
    const enemyTurn = play(battle, END_TURN);

    expect(ordersPerTurn(battle.state, battle.defs, 1)).toBeNull();
    expect(ordersLeft(enemyTurn.state, enemyTurn.defs)).toBeNull();
  });
});

describe('the general', () => {
  const duelInCommand = (generalQ: number) =>
    commanded(6, [
      place('attacker', 'principes', 1, 0, 0),
      place('target', 'principes', 0, 1, 0),
      place('consul', 'consul', 0, generalQ, -2),
    ]);
  const struck = (battle: TestBattle) => play(play(battle, END_TURN), attack('attacker', 'target'));

  it('steadies the units in his command when they are hit', () => {
    // 3 points of damage: 1 + 1 for the hit, 1 less with the general 3 hexes away.
    expect(unitOf(struck(duelInCommand(3)), 'target').morale).toBe(7);
    expect(unitOf(struck(duelInCommand(-3)), 'target').morale).toBe(6);
  });

  it('rallies a broken unit even with the enemy next to it', () => {
    const broken = (generalQ: number) =>
      withUnit(duelInCommand(generalQ), 'target', { morale: 1, moraleState: 'routing' });
    const led = play(play(broken(3), END_TURN), END_TURN);
    const alone = play(play(broken(-3), END_TURN), END_TURN);

    expect(unitOf(led, 'target')).toMatchObject({ status: 'active', moraleState: 'shaken' });
    expect(unitOf(alone, 'target')).toMatchObject({ status: 'fled' });
  });

  it('shakes his whole army and costs it orders when he falls', () => {
    const battle = withUnit(
      commanded(6, [
        place('attacker', 'principes', 1, 0, 0),
        place('consul', 'consul', 0, 1, 0),
        place('line', 'hastati', 0, 4, -4),
      ]),
      'consul',
      { hp: 1 }
    );
    const after = play(play(battle, END_TURN), attack('attacker', 'consul'));

    expect(after.events).toContainEqual({ type: 'GeneralFell', player: 0, unitId: 'consul' });
    expect(unitOf(after, 'line').morale).toBe(5);
    expect(ordersPerTurn(after.state, after.defs, 0)).toBe(4);
  });

  it('is not counted when the army breaks', () => {
    const battle = commanded(6, [
      place('consul', 'consul', 0, 0, 0),
      place('a', 'hastati', 0, 1, 0),
      place('b', 'hastati', 0, 2, 0),
    ]);

    expect(armyLosses(battle.state, battle.defs, 0)).toMatchObject({ brought: 2 });
  });
});
