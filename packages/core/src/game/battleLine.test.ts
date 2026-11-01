import { describe, expect, it } from 'vitest';
import { RULES } from '../data/rules';
import type { Hex } from '../hex/hex';
import { hex } from '../hex/hex';
import { attackFactors, isCharge, isRearAttack, previewDisengagement } from './combat';
import type { AttackResolvedEvent, Command, GameEvent } from './command';
import type { TestBattle } from './testSupport';
import { EXACT_RULES, END_TURN, battleWith, place, play, unitOf, withUnit } from './testSupport';
import type { FieldedUnit } from './unit';
import { armyLosses } from './victory';

const attack = (unitId: string, targetId: string): Command => ({
  type: 'Attack',
  unitId,
  targetId,
});
const move = (unitId: string, ...path: Hex[]): Command => ({ type: 'MoveUnit', unitId, path });

function damageOf(events: readonly GameEvent[]): number {
  const event = events.find((e): e is AttackResolvedEvent => e.type === 'AttackResolved');
  if (!event) throw new Error('No attack was resolved');
  return event.damage;
}

function fielded(battle: TestBattle, unitId: string): FieldedUnit {
  return unitOf(battle, unitId) as FieldedUnit;
}

describe('morale by the weight of the hit', () => {
  it('costs a light hit one point and a heavy one more', () => {
    const shot = battleWith([
      place('velites', 'velites', 0, 0, 0),
      place('target', 'principes', 1, 2, 0),
    ]);
    const blow = battleWith([
      place('attacker', 'principes', 0, 0, 0),
      place('target', 'principes', 1, 1, 0),
    ]);

    // 3 × 3 / 6 rounds to 2: under 3 points of damage, one point of morale.
    expect(unitOf(play(shot, attack('velites', 'target')), 'target').morale).toBe(7);
    // 3 × 6 / 6 = 3: one for the hit, one for the 3 points.
    expect(unitOf(play(blow, attack('attacker', 'target')), 'target').morale).toBe(6);
  });

  it('costs a unit with its line beside it a point less', () => {
    const supported = battleWith([
      place('attacker', 'principes', 0, 0, 0),
      place('target', 'principes', 1, 1, 0),
      place('neighbour', 'hastati', 1, 2, -1),
    ]);

    expect(unitOf(play(supported, attack('attacker', 'target')), 'target').morale).toBe(7);
    expect(
      attackFactors(
        supported.state,
        supported.defs,
        fielded(supported, 'attacker'),
        fielded(supported, 'target')
      ).factors
    ).toContainEqual({ id: 'support', helps: false });
  });
});

describe('attack into the rear', () => {
  const caught = (behindQ: number, behindR: number) =>
    battleWith([
      place('attacker', 'principes', 0, 0, 0),
      place('target', 'principes', 1, 1, 0),
      place('other', 'hastati', 0, behindQ, behindR),
    ]);

  it('hits harder and shakes more when a unit of the attacker stands behind the target', () => {
    const rear = caught(2, 0);
    const flank = caught(2, -1);

    expect(isRearAttack(rear.state, fielded(rear, 'attacker'), fielded(rear, 'target'))).toBe(true);
    expect(isRearAttack(flank.state, fielded(flank, 'attacker'), fielded(flank, 'target'))).toBe(
      false
    );
    const intoRear = play(rear, attack('attacker', 'target'));
    expect(damageOf(intoRear.events)).toBe(5); // 3 × 1.1 for the flank × 1.5 for the rear
    expect(damageOf(play(flank, attack('attacker', 'target')).events)).toBe(3);
    // One for the hit, one for 5 points, two for the rear, two for being worn.
    expect(unitOf(intoRear, 'target').morale).toBe(2);
    expect(
      attackFactors(rear.state, rear.defs, fielded(rear, 'attacker'), fielded(rear, 'target'))
        .factors
    ).toContainEqual({ id: 'rear', helps: true });
  });
});

describe('leaving the zone of control', () => {
  const engaged = (typeId: string) =>
    battleWith([place('unit', typeId, 0, 0, 0), place('gauls', 'gallic-mercenaries', 1, 1, 0)]);

  it('costs a free strike of the enemy left behind', () => {
    const battle = engaged('hastati');
    const after = play(battle, move('unit', hex(0, 0), hex(-1, 0)));
    const strike = after.events.find((event) => event.type === 'UnitDisengaged');

    expect(strike).toMatchObject({ unitId: 'unit', strikerId: 'gauls' });
    expect(strike && 'damage' in strike && strike.damage).toBeGreaterThan(0);
    expect(unitOf(after, 'unit')).toMatchObject({ pos: hex(-1, 0) });
    expect(unitOf(after, 'unit').hp).toBeLessThan(unitOf(battle, 'unit').hp);
    expect(
      previewDisengagement(battle.state, battle.defs, fielded(battle, 'unit'), [
        hex(0, 0),
        hex(-1, 0),
      ])
    ).toMatchObject({ strikerId: 'gauls' });
  });

  it('is free for light troops and horsemen, and for a step along the enemy line', () => {
    const light = play(engaged('velites'), move('unit', hex(0, 0), hex(-1, 0)));
    const along = play(engaged('hastati'), move('unit', hex(0, 0), hex(0, 1)));

    expect(light.events.some((event) => event.type === 'UnitDisengaged')).toBe(false);
    expect(along.events.some((event) => event.type === 'UnitDisengaged')).toBe(false);
  });

  it('sends a unit the strike breaks running instead of where it was sent', () => {
    const brittle = withUnit(engaged('hastati'), 'unit', { morale: 2, moraleState: 'shaken' });
    const after = play(brittle, move('unit', hex(0, 0), hex(-1, 0)));

    expect(unitOf(after, 'unit').moraleState).toBe('routing');
    expect(after.events.some((event) => event.type === 'UnitMoved')).toBe(false);
    expect(after.events.some((event) => event.type === 'UnitRetreated')).toBe(true);
  });
});

describe('cavalry charge', () => {
  const field = (targetType: string) =>
    battleWith([place('equites', 'equites', 0, -4, 0), place('target', targetType, 1, 1, 0)]);
  const ride = (battle: TestBattle, ...path: Hex[]) => play(battle, move('equites', ...path));
  const longRide = [hex(-4, 0), hex(-3, 0), hex(-2, 0), hex(-1, 0), hex(0, 0)];

  it('strikes harder after a ride of four hexes', () => {
    const charged = ride(field('hastati'), ...longRide);
    const standing = withUnit(field('hastati'), 'equites', { pos: hex(0, 0) });

    expect(unitOf(charged, 'equites').movedThisTurn).toBe(4);
    expect(isCharge(charged.defs, fielded(charged, 'equites'), fielded(charged, 'target'))).toBe(
      true
    );
    expect(isCharge(standing.defs, fielded(standing, 'equites'), fielded(standing, 'target'))).toBe(
      false
    );
    expect(damageOf(play(charged, attack('equites', 'target')).events)).toBeGreaterThan(
      damageOf(play(standing, attack('equites', 'target')).events)
    );
  });

  it('breaks on spears and needs the full ride', () => {
    const onSpears = ride(field('triarii'), ...longRide);
    const short = ride(
      withUnit(field('hastati'), 'equites', { pos: hex(-2, 0) }),
      hex(-2, 0),
      hex(-1, 0),
      hex(0, 0)
    );

    expect(isCharge(onSpears.defs, fielded(onSpears, 'equites'), fielded(onSpears, 'target'))).toBe(
      false
    );
    expect(isCharge(short.defs, fielded(short, 'equites'), fielded(short, 'target'))).toBe(false);
  });

  it('is forgotten when the next turn starts', () => {
    const charged = ride(field('hastati'), ...longRide);

    expect(unitOf(play(charged, END_TURN, END_TURN), 'equites').movedThisTurn).toBe(0);
  });
});

describe('breaking of an army', () => {
  const rules = { ...EXACT_RULES, victory: RULES.victory };
  const armies = () =>
    battleWith(
      [
        place('attacker', 'principes', 0, 0, 0),
        place('rome', 'hastati', 0, -4, 0),
        place('target', 'hastati', 1, 1, 0),
        place('fallen', 'hastati', 1, 4, -4),
        place('second', 'hastati', 1, 4, 0),
        place('third', 'hastati', 1, 0, 4),
      ],
      { rules }
    );

  it('ends the battle once half of the army is lost', () => {
    const battle = withUnit(withUnit(armies(), 'fallen', { status: 'fled', pos: null }), 'target', {
      hp: 1,
    });
    const after = play(battle, attack('attacker', 'target'));

    expect(armyLosses(battle.state, battle.defs, 1)).toEqual({
      brought: 4,
      lost: 1,
      untilBreak: 1,
    });
    expect(after.state).toMatchObject({
      phase: 'ended',
      winner: { player: 0, reason: 'armyBroken' },
    });
  });

  it('goes on while less than half is lost', () => {
    const after = play(withUnit(armies(), 'target', { hp: 1 }), attack('attacker', 'target'));

    expect(after.state.phase).toBe('battle');
    expect(armyLosses(after.state, after.defs, 1).untilBreak).toBe(1);
  });
});
