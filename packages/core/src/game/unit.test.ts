import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../data/abilities';
import { RULES } from '../data/rules';
import { UNIT_TYPES } from '../data/unitTypes';
import { hex } from '../hex/hex';
import { createBattle } from './battleState';
import { battleWith, place, unitOf, withUnit } from './testSupport';
import type { FieldedUnit } from './unit';
import { abilityOf, adjacentUnits, createUnits, fieldedUnits, unitAt, unitTypeOf } from './unit';

describe('unit type data', () => {
  it('stores every unit type under its id', () => {
    for (const [id, unitType] of Object.entries(UNIT_TYPES)) {
      expect(unitType.id).toBe(id);
    }
    expect(Object.keys(UNIT_TYPES)).toHaveLength(11);
  });

  it('gives every unit type sensible numbers and known abilities', () => {
    for (const unitType of Object.values(UNIT_TYPES)) {
      for (const stat of [unitType.attack, unitType.defense, unitType.hp, unitType.movement]) {
        expect(stat).toBeGreaterThan(0);
      }
      expect(unitType.morale).toBeGreaterThan(RULES.morale.shakenAt);
      expect(unitType.morale).toBeLessThanOrEqual(RULES.morale.max);
      for (const abilityId of unitType.abilities) {
        expect(ABILITIES[abilityId].id).toBe(abilityId);
      }
    }
  });

  it('has both factions of the test version', () => {
    const factions = new Set(Object.values(UNIT_TYPES).map((unitType) => unitType.factionId));

    expect([...factions].sort()).toEqual(['carthage', 'rome']);
  });
});

describe('createUnits', () => {
  it('creates fresh units from their type', () => {
    const [velites] = createUnits(UNIT_TYPES, RULES.morale, [
      { typeId: 'velites', owner: 1, pos: hex(2, -1) },
    ]);

    expect(velites).toEqual({
      id: 'p1-velites-1',
      typeId: 'velites',
      owner: 1,
      pos: hex(2, -1),
      hp: 6,
      morale: 6,
      moraleState: 'steady',
      movementLeft: 5,
      hasAttacked: false,
      status: 'active',
      hasRetreated: false,
      spentAbilities: [],
    });
  });

  it('numbers units of the same owner and type', () => {
    const units = createUnits(UNIT_TYPES, RULES.morale, [
      { typeId: 'hastati', owner: 0, pos: hex(0, 0) },
      { typeId: 'hastati', owner: 0, pos: hex(1, 0) },
      { typeId: 'hastati', owner: 1, pos: hex(2, 0) },
      { typeId: 'triarii', owner: 0, pos: hex(3, 0), id: 'old-guard' },
    ]);

    expect(units.map((unit) => unit.id)).toEqual([
      'p0-hastati-1',
      'p0-hastati-2',
      'p1-hastati-1',
      'old-guard',
    ]);
  });

  it('refuses a unit type that does not exist', () => {
    expect(() =>
      createUnits(UNIT_TYPES, RULES.morale, [{ typeId: 'phalanx', owner: 0, pos: hex(0, 0) }])
    ).toThrow('Unknown unit type: "phalanx"');
  });

  it('cannot put two units with the same id into a battle', () => {
    const units = createUnits(UNIT_TYPES, RULES.morale, [
      { typeId: 'hastati', owner: 0, pos: hex(0, 0), id: 'twin' },
      { typeId: 'hastati', owner: 0, pos: hex(1, 0), id: 'twin' },
    ]);

    expect(() => createBattle({ scenarioId: 'test', seed: 1, units })).toThrow(
      'Duplicate unit id: "twin"'
    );
  });
});

describe('unit queries', () => {
  const battle = withUnit(
    battleWith([
      place('hastati', 'hastati', 0, 0, 0),
      place('principes', 'principes', 0, 1, 0),
      place('fallen', 'triarii', 0, 0, 1),
      place('gauls', 'gallic-mercenaries', 1, 1, -1),
    ]),
    'fallen',
    { status: 'dead', pos: null }
  );

  it('list the units on the field, of everybody or of one side', () => {
    const ids = (units: FieldedUnit[]) => units.map((unit) => unit.id);

    expect(ids(fieldedUnits(battle.state))).toEqual(['hastati', 'principes', 'gauls']);
    expect(ids(fieldedUnits(battle.state, 1))).toEqual(['gauls']);
  });

  it('find the unit on a hex and the units around it', () => {
    expect(unitAt(battle.state, hex(1, 0))?.id).toBe('principes');
    expect(unitAt(battle.state, hex(0, 1))).toBeUndefined();
    expect(adjacentUnits(battle.state, hex(0, 0), 0).map((unit) => unit.id)).toEqual(['principes']);
    expect(adjacentUnits(battle.state, hex(0, 0), 1).map((unit) => unit.id)).toEqual(['gauls']);
  });

  it('look up the type and the abilities of a unit', () => {
    expect(unitTypeOf(battle.defs, unitOf(battle, 'gauls')).name).toBe('Gallic mercenaries');
    expect(abilityOf(battle.defs, unitOf(battle, 'gauls'), 'furiousCharge')).toBe(
      ABILITIES.furiousCharge
    );
    expect(abilityOf(battle.defs, unitOf(battle, 'gauls'), 'pilum')).toBeUndefined();
    expect(() =>
      unitTypeOf(battle.defs, { ...unitOf(battle, 'gauls'), typeId: 'phalanx' })
    ).toThrow('unknown type "phalanx"');
  });
});
