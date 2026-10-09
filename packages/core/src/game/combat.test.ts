import { describe, expect, it } from 'vitest';
import { RULES } from '../data/rules';
import { hex } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import type { TerrainId } from '../map/terrain';
import { attackTargets, previewAttack } from './combat';
import type { AttackResolvedEvent, Command, GameEvent } from './command';
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

function attack(unitId: string, targetId: string): Command {
  return { type: 'Attack', unitId, targetId };
}

function resolved(events: readonly GameEvent[]): AttackResolvedEvent {
  const event = events.find((candidate) => candidate.type === 'AttackResolved');
  if (!event) throw new Error('No attack was resolved');
  return event;
}

/** Damage and counter-damage of `attacker` attacking `target` in the given battle. */
function strike(
  battle: TestBattle,
  attacker = 'attacker',
  target = 'target'
): [number, number | null] {
  const { damage, counterDamage } = resolved(play(battle, attack(attacker, target)).events);
  return [damage, counterDamage];
}

/** `attackerType` at (0,0) attacking `targetType` next to it, plus any other units. */
function duel(attackerType: string, targetType: string, ...others: UnitPlacement[]): TestBattle {
  return battleWith([
    place('attacker', attackerType, 0, 0, 0),
    place('target', targetType, 1, 1, 0),
    ...others,
  ]);
}

function terrainDuel(
  attackerType: string,
  targetType: string,
  attackerGround: TerrainId,
  targetGround: TerrainId
): TestBattle {
  const open = createMap('ground', hexagonHexes(3));
  const map = paintTerrain(paintTerrain(open, attackerGround, [hex(0, 0)]), targetGround, [
    hex(1, 0),
  ]);
  return battleWith(
    [place('attacker', attackerType, 0, 0, 0), place('target', targetType, 1, 1, 0)],
    { map }
  );
}

describe('melee', () => {
  it('does the base damage when attack equals defence and takes half an answer back', () => {
    const after = play(duel('principes', 'principes'), attack('attacker', 'target'));

    expect(after.events.slice(0, 3)).toEqual([
      {
        type: 'AttackResolved',
        attackerId: 'attacker',
        targetId: 'target',
        kind: 'melee',
        damage: 3,
        counterDamage: 1,
      },
      { type: 'UnitDamaged', unitId: 'target', damage: 3, hp: 7 },
      { type: 'UnitDamaged', unitId: 'attacker', damage: 1, hp: 9 },
    ]);
    expect(unitOf(after, 'target').hp).toBe(7);
    expect(unitOf(after, 'attacker').hp).toBe(9);
  });

  it('ends the turn of the attacking unit', () => {
    const after = play(duel('principes', 'principes'), attack('attacker', 'target'));

    expect(unitOf(after, 'attacker')).toMatchObject({ hasAttacked: true, movementLeft: 0 });
    expect(rejectionOf(after, attack('attacker', 'target'))).toBe('alreadyAttacked');
    expect(rejectionOf(nextRound(after), attack('attacker', 'target'))).toBeNull();
  });

  it('scales damage with attack against defence', () => {
    expect(strike(duel('gallic-mercenaries', 'triarii'))[0]).toBe(3); // 3 × (7 + 2) / 8
    expect(strike(duel('triarii', 'gallic-mercenaries'))[0]).toBe(5); // 3 × 5 / 3
  });

  it('always does at least one point of damage', () => {
    const weak = withUnit(terrainDuel('velites', 'triarii', 'plain', 'camp'), 'attacker', {
      hp: 1,
    });

    expect(strike(weak)).toEqual([1, 1]); // 3 × 3 / 11 × 58 % rounds to nothing
  });

  it('strikes weaker the more health the unit has lost', () => {
    const wounded = withUnit(duel('principes', 'principes'), 'attacker', { hp: 5 });

    expect(strike(wounded)[0]).toBe(2); // 3 × 75 %
  });

  it('gives a bonus against the archetype the unit is strong against', () => {
    expect(strike(duel('libyan-spearmen', 'equites'))[0]).toBe(5); // 3 × 5 / 4 × 1.25
    expect(strike(duel('iberian-cavalry', 'equites'))[0]).toBe(5); // 3 × 6 / 4, no bonus
    expect(strike(duel('equites', 'velites'))[0]).toBe(6); // would be 9, the target has 6
  });

  it('gives a bonus for every other friendly unit next to the target', () => {
    const alone = duel('hastati', 'hastati');
    const flanking = duel(
      'hastati',
      'hastati',
      place('second', 'hastati', 0, 2, 0),
      place('third', 'hastati', 0, 1, 1)
    );

    expect(strike(alone)[0]).toBe(4); // 3 × (5 + 2) / 5
    expect(strike(flanking)[0]).toBe(5); // × 1.2
  });

  it('does not count a routing unit as flanking', () => {
    const flanking = duel(
      'hastati',
      'hastati',
      place('second', 'hastati', 0, 2, 0),
      place('third', 'hastati', 0, 1, 1)
    );
    const routed = withUnit(withUnit(flanking, 'second', { moraleState: 'routing' }), 'third', {
      moraleState: 'routing',
    });

    expect(strike(routed)[0]).toBe(4);
  });

  it('rejects attacks on anything but an enemy unit on the field', () => {
    const battle = withUnit(
      duel('principes', 'principes', place('friend', 'hastati', 0, 0, 1)),
      'target',
      { status: 'dead', pos: null }
    );

    expect(rejectionOf(battle, attack('attacker', 'friend'))).toBe('invalidTarget');
    expect(rejectionOf(battle, attack('attacker', 'nobody'))).toBe('invalidTarget');
    expect(rejectionOf(battle, attack('attacker', 'target'))).toBe('invalidTarget');
    expect(rejectionOf(battle, attack('target', 'attacker'))).toBe('notYourUnit');
  });

  it('cannot reach a unit that is not adjacent', () => {
    const apart = battleWith([
      place('attacker', 'principes', 0, 0, 0),
      place('target', 'principes', 1, 2, 0),
    ]);

    expect(rejectionOf(apart, attack('attacker', 'target'))).toBe('outOfRange');
  });
});

describe('terrain in combat', () => {
  it('adds the defence bonus of the hex the target stands on', () => {
    expect(strike(terrainDuel('principes', 'principes', 'plain', 'forest'))[0]).toBe(2); // 6 / 8
    expect(strike(terrainDuel('principes', 'principes', 'plain', 'marsh'))[0]).toBe(4); // 6 / 5
  });

  it('gives a bonus for attacking downhill, but not along a ridge', () => {
    expect(strike(terrainDuel('principes', 'principes', 'hill', 'plain'))[0]).toBe(4); // 7 / 6
    expect(strike(terrainDuel('principes', 'principes', 'hill', 'hill'))[0]).toBe(2); // 6 / 8
  });

  it('weakens an attack made out of a ford', () => {
    expect(strike(terrainDuel('principes', 'principes', 'ford', 'plain'))[0]).toBe(2); // 4 / 6
  });

  it('weakens cavalry in a forest and gives it no cover there', () => {
    expect(strike(terrainDuel('equites', 'principes', 'plain', 'plain'))[0]).toBe(3); // 5 / 6
    expect(strike(terrainDuel('equites', 'principes', 'forest', 'plain'))[0]).toBe(2); // 3 / 6
    expect(strike(terrainDuel('principes', 'equites', 'plain', 'forest'))[0]).toBe(5); // 6 / 4
  });
});

describe('shooting', () => {
  const shooting = (...others: UnitPlacement[]) =>
    battleWith([
      place('velites', 'velites', 0, 0, 0),
      place('target', 'principes', 1, 2, 0),
      ...others,
    ]);

  it('hurts a distant target without being struck back', () => {
    const after = play(shooting(), attack('velites', 'target'));

    expect(resolved(after.events)).toMatchObject({
      kind: 'ranged',
      damage: 2,
      counterDamage: null,
    });
    expect(unitOf(after, 'velites').hp).toBe(6);
  });

  it('reaches only as far as the range of the unit', () => {
    const far = withUnit(shooting(), 'target', { pos: hex(3, 0) });

    expect(rejectionOf(far, attack('velites', 'target'))).toBe('outOfRange');
  });

  it('reaches one hex further from a hill', () => {
    const map = paintTerrain(createMap('hill', hexagonHexes(5)), 'hill', [hex(0, 0)]);
    const battle = battleWith(
      [place('velites', 'velites', 0, 0, 0), place('target', 'principes', 1, 3, 0)],
      { map }
    );

    expect(rejectionOf(battle, attack('velites', 'target'))).toBeNull();
  });

  it('needs to see the target', () => {
    const map = paintTerrain(createMap('wood', hexagonHexes(5)), 'forest', [hex(1, 0)]);
    const behindWood = battleWith(
      [place('velites', 'velites', 0, 0, 0), place('target', 'principes', 1, 2, 0)],
      { map }
    );
    const behindUnit = shooting(place('screen', 'hastati', 0, 1, 0));

    expect(rejectionOf(behindWood, attack('velites', 'target'))).toBe('noLineOfSight');
    expect(rejectionOf(behindUnit, attack('velites', 'target'))).toBe('noLineOfSight');
  });

  it('is not possible with an enemy next to the shooter', () => {
    const engaged = shooting(place('gauls', 'gallic-mercenaries', 1, 0, 1));

    expect(rejectionOf(engaged, attack('velites', 'target'))).toBe('engaged');
  });

  it('fights hand to hand against an adjacent enemy', () => {
    const engaged = shooting(place('gauls', 'gallic-mercenaries', 1, 0, 1));

    expect(resolved(play(engaged, attack('velites', 'gauls')).events)).toMatchObject({
      kind: 'melee',
      damage: 3,
      counterDamage: 4,
    });
  });

  it('lists the enemies a unit can attack from where it stands', () => {
    const battle = shooting(
      place('far', 'principes', 1, 4, 0),
      place('alsoNear', 'principes', 1, 0, 2)
    );
    const velites = unitOf(battle, 'velites') as FieldedUnit;

    const targets = attackTargets(battle.state, battle.defs, velites).map((unit) => unit.id);

    expect(targets.sort()).toEqual(['alsoNear', 'target']);
  });
});

describe('abilities', () => {
  it('pilum strengthens only the first attack of the battle', () => {
    const first = play(duel('hastati', 'principes'), attack('attacker', 'target'));
    const second = play(nextRound(first), attack('attacker', 'target'));

    expect(resolved(first.events).damage).toBe(4); // 3 × (5 + 2) / 6
    expect(unitOf(first, 'attacker').spentAbilities).toEqual(['pilum']);
    expect(resolved(second.events).damage).toBe(2); // 3 × 5 / 6 at 9 of 10 health
    expect(unitOf(second, 'attacker').spentAbilities).toEqual(['pilum']);
  });

  it('pilum is not thrown in a counter-attack', () => {
    const battle = play(duel('principes', 'hastati'), attack('attacker', 'target'));

    expect(unitOf(battle, 'target').spentAbilities).toEqual([]);
  });

  it('furious charge strengthens attacks but not counter-attacks', () => {
    expect(strike(duel('gallic-mercenaries', 'principes'))[0]).toBe(5); // 3 × 9 / 6
    expect(strike(duel('principes', 'gallic-mercenaries'))).toEqual([6, 1]); // back: 3 × 7 / 6 × 0.7 / 2
  });

  it('shield wall raises defence against cavalry only', () => {
    expect(strike(duel('equites', 'triarii'))[0]).toBe(1); // 3 × 5 / 11
    expect(strike(duel('hastati', 'triarii'))[0]).toBe(3); // 3 × 7 / 8
  });

  it('hit and run is not struck back and leaves movement to ride away', () => {
    const after = play(duel('numidian-cavalry', 'principes'), attack('attacker', 'target'));

    expect(resolved(after.events)).toMatchObject({ kind: 'melee', damage: 2, counterDamage: null });
    expect(unitOf(after, 'attacker')).toMatchObject({ hp: 7, movementLeft: 4, hasAttacked: true });
    expect(
      rejectionOf(after, { type: 'MoveUnit', unitId: 'attacker', path: [hex(0, 0), hex(-1, 0)] })
    ).toBeNull();
    expect(rejectionOf(after, attack('attacker', 'target'))).toBe('alreadyAttacked');
  });

  it('fear weakens enemy cavalry next to the elephants', () => {
    expect(strike(duel('equites', 'war-elephants'))[0]).toBe(2); // 3 × (5 − 2) / 5
    expect(strike(duel('hastati', 'war-elephants'))[0]).toBe(4); // 3 × 7 / 5, no fear
    expect(
      strike(duel('equites', 'principes', place('elephants', 'war-elephants', 1, 0, 1)))[0]
    ).toBe(2); // 3 × 3 / 6 instead of 3 × 5 / 6
  });
});

describe('death', () => {
  const lastStand = () =>
    withUnit(
      duel('principes', 'principes', place('reserve', 'libyan-spearmen', 1, 2, 0)),
      'target',
      { hp: 2 }
    );

  it('removes a unit whose health runs out', () => {
    const after = play(lastStand(), attack('attacker', 'target'));

    expect(unitOf(after, 'target')).toMatchObject({ hp: 0, status: 'dead', pos: null });
    expect(resolved(after.events)).toMatchObject({ damage: 2, counterDamage: null });
    expect(after.events).toContainEqual({ type: 'UnitDied', unitId: 'target', hex: hex(1, 0) });
    expect(after.state.phase).toBe('battle');
  });

  it('frees the hex of the dead unit', () => {
    const after = nextRound(play(lastStand(), attack('attacker', 'target')));
    const step = { type: 'MoveUnit', unitId: 'attacker', path: [hex(0, 0), hex(1, 0)] } as const;

    expect(unitOf(play(after, step), 'attacker').pos).toEqual(hex(1, 0));
  });

  it('can kill the attacker with the counter-attack', () => {
    const reckless = withUnit(duel('velites', 'gallic-mercenaries'), 'attacker', { hp: 1 });

    const after = play(reckless, attack('attacker', 'target'));

    expect(unitOf(after, 'attacker')).toMatchObject({ status: 'dead', pos: null });
    expect(after.state.winner).toEqual({ player: 1, reason: 'armyBroken' });
  });

  it('wins the battle when the last enemy unit falls', () => {
    const alone = withUnit(duel('principes', 'principes'), 'target', { hp: 1 });

    const after = play(alone, attack('attacker', 'target'));

    expect(after.state).toMatchObject({
      phase: 'ended',
      winner: { player: 0, reason: 'armyBroken' },
    });
    expect(after.events.at(-1)).toEqual({ type: 'BattleEnded', winner: 0, reason: 'armyBroken' });
    expect(rejectionOf(after, END_TURN)).toBe('battleEnded');
  });
});

describe('random spread', () => {
  const charge = (seed: number) =>
    battleWith([place('attacker', 'war-elephants', 0, 0, 0), place('target', 'triarii', 1, 1, 0)], {
      rules: RULES,
      seed,
    });

  it('keeps the damage within ten percent of the expected value', () => {
    const seeds = Array.from({ length: 80 }, (_, seed) => seed);

    const damages = seeds.map((seed) => strike(charge(seed))[0]);

    // 3 × 8 / 8 × 1.25 = 3.75, so 3.4 to 4.1 before rounding
    expect([...new Set(damages)].sort()).toEqual([3, 4]);
  });

  it('gives the same result for the same seed', () => {
    expect(play(charge(7), attack('attacker', 'target')).state).toEqual(
      play(charge(7), attack('attacker', 'target')).state
    );
  });

  it('moves the random generator on for every strike', () => {
    const melee = play(charge(7), attack('attacker', 'target'));

    expect(melee.state.rng.state).not.toBe(charge(7).state.rng.state);
  });
});

describe('previewAttack', () => {
  it('shows the range of losses of both sides without changing anything', () => {
    const battle = battleWith(
      [place('attacker', 'war-elephants', 0, 0, 0), place('target', 'triarii', 1, 1, 0)],
      { rules: RULES }
    );
    const attacker = unitOf(battle, 'attacker') as FieldedUnit;
    const target = unitOf(battle, 'target') as FieldedUnit;

    expect(previewAttack(battle.state, battle.defs, attacker, target)).toEqual({
      kind: 'melee',
      damage: { min: 3, expected: 4, max: 4 },
      counterDamage: { min: 1, expected: 1, max: 1 },
    });
  });

  it('covers every result the attack can have', () => {
    for (let seed = 0; seed < 40; seed++) {
      const battle = battleWith(
        [place('attacker', 'gallic-mercenaries', 0, 0, 0), place('target', 'hastati', 1, 1, 0)],
        { rules: RULES, seed }
      );
      const preview = previewAttack(
        battle.state,
        battle.defs,
        unitOf(battle, 'attacker') as FieldedUnit,
        unitOf(battle, 'target') as FieldedUnit
      );
      if (!('damage' in preview) || !preview.counterDamage) throw new Error('No preview');

      const [damage, counterDamage] = strike(battle);

      expect(damage).toBeGreaterThanOrEqual(preview.damage.min);
      expect(damage).toBeLessThanOrEqual(preview.damage.max);
      expect(counterDamage).toBeGreaterThanOrEqual(preview.counterDamage.min);
      expect(counterDamage).toBeLessThanOrEqual(preview.counterDamage.max);
    }
  });

  it('shows no counter-attack for shooting and gives the reason when the attack is impossible', () => {
    const battle = battleWith([
      place('velites', 'velites', 0, 0, 0),
      place('near', 'principes', 1, 2, 0),
      place('far', 'principes', 1, 4, 0),
    ]);
    const velites = unitOf(battle, 'velites') as FieldedUnit;
    const preview = (targetId: string) =>
      previewAttack(battle.state, battle.defs, velites, unitOf(battle, targetId) as FieldedUnit);

    expect(preview('near')).toMatchObject({ kind: 'ranged', counterDamage: null });
    expect(preview('far')).toMatchObject({ code: 'outOfRange' });
  });
});
