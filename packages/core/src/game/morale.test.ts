import { describe, expect, it } from 'vitest';
import type { Hex } from '../hex/hex';
import { hex, hexDistance, hexNeighbors } from '../hex/hex';
import { hasHex } from '../map/battleMap';
import type { Command } from './command';
import { isEncircled } from './morale';
import type { TestBattle } from './testSupport';
import {
  END_TURN,
  battleWith,
  nextRound,
  place,
  play,
  rejectionOf,
  unitOf,
  withUnit,
} from './testSupport';
import type { FieldedUnit, UnitPlacement } from './unit';
import { moraleStateOf } from './unit';

function attack(unitId: string, targetId: string): Command {
  return { type: 'Attack', unitId, targetId };
}

/** Principes at (0,0) attacking principes next to them, plus any other units. */
function duel(...others: UnitPlacement[]): TestBattle {
  return battleWith([
    place('attacker', 'principes', 0, 0, 0),
    place('target', 'principes', 1, 1, 0),
    ...others,
  ]);
}

function routing(battle: TestBattle, unitId: string): TestBattle {
  return withUnit(battle, unitId, { morale: 1, moraleState: 'routing' });
}

/** Puts the attacker on a hex of the map next to the unit that ran to `refuge`. */
function pursue(battle: TestBattle, refuge: Hex): TestBattle {
  const next = hexNeighbors(refuge).find((neighbor) => hasHex(battle.defs.map, neighbor));
  return withUnit(battle, 'attacker', { pos: next });
}

describe('morale states', () => {
  it('follow from the morale value', () => {
    const rules = duel().defs.rules.morale;

    expect([10, 5, 4, 2, 1, 0].map((morale) => moraleStateOf(morale, rules))).toEqual([
      'steady',
      'steady',
      'shaken',
      'shaken',
      'routing',
      'routing',
    ]);
  });

  it('start from the morale of the unit type', () => {
    const battle = battleWith([
      place('triarii', 'triarii', 0, 0, 0),
      place('gauls', 'gallic-mercenaries', 1, 3, 0),
    ]);

    expect(unitOf(battle, 'triarii')).toMatchObject({ morale: 9, moraleState: 'steady' });
    expect(unitOf(battle, 'gauls')).toMatchObject({ morale: 5, moraleState: 'steady' });
  });
});

describe('morale in combat', () => {
  it('drops for a unit that is hit and rises for an attacker that won the exchange', () => {
    const after = play(withUnit(duel(), 'attacker', { morale: 6 }), attack('attacker', 'target'));

    // The attacker loses two for the counter-attack and gains one for doing more damage.
    expect(unitOf(after, 'attacker').morale).toBe(5);
    expect(unitOf(after, 'target').morale).toBe(6);
    expect(after.events).toContainEqual({
      type: 'MoraleChanged',
      unitId: 'target',
      morale: 6,
      moraleState: 'steady',
    });
  });

  it('never rises above the maximum', () => {
    const proud = withUnit(
      battleWith([place('velites', 'velites', 0, 0, 0), place('target', 'principes', 1, 2, 0)]),
      'velites',
      { morale: 10 }
    );

    expect(unitOf(play(proud, attack('velites', 'target')), 'velites').morale).toBe(10);
  });

  it('drops faster for a unit that is encircled', () => {
    const battle = duel(place('second', 'hastati', 0, 2, 0), place('third', 'hastati', 0, 1, 1));
    const target = unitOf(battle, 'target') as FieldedUnit;

    expect(isEncircled(battle.state, battle.defs, target)).toBe(true);
    expect(isEncircled(duel().state, battle.defs, target)).toBe(false);
    expect(unitOf(play(battle, attack('attacker', 'target')), 'target').morale).toBe(5);
  });

  it('drops by one more when elephants do the damage', () => {
    const battle = battleWith([
      place('elephants', 'war-elephants', 0, 0, 0),
      place('target', 'principes', 1, 1, 0),
    ]);

    expect(unitOf(play(battle, attack('elephants', 'target')), 'target')).toMatchObject({
      hp: 5,
      morale: 5,
    });
  });

  it('drops for units that see a neighbour of their side destroyed', () => {
    const battle = withUnit(
      duel(place('neighbour', 'hastati', 1, 2, 0), place('distant', 'hastati', 1, 4, 0)),
      'target',
      { hp: 1 }
    );

    const after = play(battle, attack('attacker', 'target'));

    expect(unitOf(after, 'neighbour').morale).toBe(6);
    expect(unitOf(after, 'distant').morale).toBe(7);
  });

  it('makes a shaken unit strike weaker', () => {
    const shaken = withUnit(duel(), 'attacker', { morale: 4, moraleState: 'shaken' });

    expect(play(shaken, attack('attacker', 'target')).events[0]).toMatchObject({ damage: 2 });
  });

  it('turns a unit shaken and then routing as it keeps being hit', () => {
    const wavering = withUnit(duel(), 'target', { morale: 5 });
    const breaking = withUnit(duel(), 'target', { morale: 2, moraleState: 'shaken' });

    expect(unitOf(play(wavering, attack('attacker', 'target')), 'target').moraleState).toBe(
      'shaken'
    );
    expect(unitOf(play(breaking, attack('attacker', 'target')), 'target').moraleState).toBe(
      'routing'
    );
  });
});

describe('recovery', () => {
  it('returns one point at the start of the turn when no enemy is near', () => {
    const tired = withUnit(
      battleWith([
        place('hastati', 'hastati', 0, 0, 0),
        place('gauls', 'gallic-mercenaries', 1, 3, 0),
      ]),
      'hastati',
      { morale: 4, moraleState: 'shaken' }
    );

    const after = nextRound(tired);

    expect(unitOf(after, 'hastati')).toMatchObject({ morale: 5, moraleState: 'steady' });
    expect(after.events).toContainEqual({
      type: 'MoraleChanged',
      unitId: 'hastati',
      morale: 5,
      moraleState: 'steady',
    });
  });

  it('stops at the morale of the unit type', () => {
    const fresh = battleWith([
      place('hastati', 'hastati', 0, 0, 0),
      place('gauls', 'gallic-mercenaries', 1, 3, 0),
    ]);

    expect(unitOf(nextRound(nextRound(fresh)), 'hastati').morale).toBe(7);
  });

  it('does not happen next to an enemy', () => {
    const pressed = withUnit(duel(), 'attacker', { morale: 4, moraleState: 'shaken' });

    expect(unitOf(nextRound(pressed), 'attacker').morale).toBe(4);
  });
});

describe('routing', () => {
  it('takes no orders and does not strike back', () => {
    const battle = play(routing(duel(), 'target'), END_TURN);

    expect(rejectionOf(battle, attack('target', 'attacker'))).toBe('unitRouting');
    expect(
      rejectionOf(battle, { type: 'MoveUnit', unitId: 'target', path: [hex(1, 0), hex(2, 0)] })
    ).toBe('unitRouting');
    expect(play(routing(duel(), 'target'), attack('attacker', 'target')).events[0]).toMatchObject({
      damage: 3,
      counterDamage: null,
    });
  });

  it('runs away from the enemy at the start of its turn', () => {
    const after = play(routing(duel(), 'target'), END_TURN);
    const target = unitOf(after, 'target') as FieldedUnit;

    expect(hexDistance(target.pos, hex(0, 0))).toBe(5);
    expect(target).toMatchObject({ hasRetreated: true, movementLeft: 0, moraleState: 'routing' });
    expect(after.events).toMatchObject([
      { type: 'TurnEnded' },
      { type: 'UnitRetreated', unitId: 'target' },
      { type: 'TurnStarted' },
    ]);
    const retreat = after.events[1];
    const path = retreat?.type === 'UnitRetreated' ? retreat.path : [];
    expect(path).toHaveLength(5);
    expect(path[0]).toEqual(hex(1, 0));
    expect(path.at(-1)).toEqual(target.pos);
  });

  it('stays put when there is nowhere better to run', () => {
    const cornered = routing(
      battleWith([
        place('target', 'principes', 1, 5, 0),
        place('north', 'hastati', 0, 5, -1),
        place('west', 'hastati', 0, 4, 0),
        place('south', 'hastati', 0, 4, 1),
      ]),
      'target'
    );

    const after = play(cornered, END_TURN);

    expect(unitOf(after, 'target')).toMatchObject({ pos: hex(5, 0), hasRetreated: true });
    expect(after.events[1]).toEqual({ type: 'UnitRetreated', unitId: 'target', path: [hex(5, 0)] });
  });

  it('rallies a turn later if the enemy did not follow', () => {
    const escaped = nextRound(play(routing(duel(), 'target'), END_TURN));

    expect(unitOf(escaped, 'target')).toMatchObject({
      status: 'active',
      morale: 2,
      moraleState: 'shaken',
      hasRetreated: false,
      movementLeft: 4,
    });
    expect(escaped.events).toContainEqual({ type: 'UnitRallied', unitId: 'target' });
    expect(rejectionOf(escaped, attack('target', 'attacker'))).toBe('outOfRange');
  });

  it('leaves the battlefield a turn later if the enemy caught up with it', () => {
    const fleeing = play(
      routing(duel(place('reserve', 'libyan-spearmen', 1, -4, 0)), 'target'),
      END_TURN,
      END_TURN
    );
    const refuge = (unitOf(fleeing, 'target') as FieldedUnit).pos;

    const after = play(pursue(fleeing, refuge), END_TURN);

    expect(unitOf(after, 'target')).toMatchObject({ status: 'fled', pos: null });
    expect(after.events).toContainEqual({ type: 'UnitFled', unitId: 'target', hex: refuge });
    expect(after.state.phase).toBe('battle');
  });

  it('breaks the army when its last unit leaves the battlefield', () => {
    const fleeing = play(routing(duel(), 'target'), END_TURN, END_TURN);
    const refuge = (unitOf(fleeing, 'target') as FieldedUnit).pos;

    const after = play(pursue(fleeing, refuge), END_TURN);

    expect(after.state.winner).toEqual({ player: 0, reason: 'armyBroken' });
    expect(after.events.map((event) => event.type)).toEqual([
      'TurnEnded',
      'UnitFled',
      'TurnStarted',
      'BattleEnded',
    ]);
  });

  it('does not take the enemy camp', () => {
    const battle = routing(
      battleWith(
        [place('runner', 'equites', 0, 3, 0), place('gauls', 'gallic-mercenaries', 1, -4, 0)],
        { camps: { 1: hex(4, 0) } }
      ),
      'runner'
    );

    const after = play(withUnit(battle, 'runner', { pos: hex(4, 0) }), END_TURN);

    expect(after.state.phase).toBe('battle');
  });
});
