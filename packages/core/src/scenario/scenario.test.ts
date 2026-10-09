import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../data/factions';
import { GAME_DATA } from '../data/gameData';
import { SCENARIOS } from '../data/scenarios';
import { UNIT_TYPES } from '../data/unitTypes';
import { hexKey } from '../hex/hex';
import { createMap, paintTerrain, terrainAt } from '../map/battleMap';
import { rectangleHex, rectangleHexes } from '../map/shapes';
import type { GameData, ScenarioDef, ScenarioSide } from './scenario';
import { armySize, validateScenario } from './scenario';
import { scenarioDefs, startScenario } from './startScenario';

const RIVER = rectangleHex(2, 2);

const DATA: GameData = {
  ...GAME_DATA,
  maps: { field: paintTerrain(createMap('field', rectangleHexes(5, 5)), 'river', [RIVER]) },
};

const ROME: ScenarioSide = {
  factionId: 'rome',
  army: [
    { typeId: 'hastati', count: 2 },
    { typeId: 'velites', count: 1 },
  ],
  camp: rectangleHex(0, 0),
  deploymentZone: [1, 2, 3].map((column) => rectangleHex(column, 0)),
};

const CARTHAGE: ScenarioSide = {
  factionId: 'carthage',
  army: [{ typeId: 'war-elephants', count: 1 }],
  camp: rectangleHex(4, 4),
  deploymentZone: [rectangleHex(2, 4)],
};

function scenario(rome: Partial<ScenarioSide> = {}, carthage: Partial<ScenarioSide> = {}) {
  const sides = [
    { ...ROME, ...rome },
    { ...CARTHAGE, ...carthage },
  ] as const;
  return { id: 'test', name: 'Test', mapId: 'field', sides } satisfies ScenarioDef;
}

describe('validateScenario', () => {
  it('finds nothing wrong with a scenario that fits the data', () => {
    expect(validateScenario(scenario(), DATA)).toEqual([]);
  });

  it('needs the map to exist', () => {
    expect(validateScenario({ ...scenario(), mapId: 'atlantis' }, DATA)).toEqual([
      'Map "atlantis" does not exist',
    ]);
  });

  it('needs the faction to exist', () => {
    expect(validateScenario(scenario({ factionId: 'gaul' }), DATA)).toEqual([
      'Player 0: faction "gaul" does not exist',
    ]);
  });

  it('needs an army of known unit types of the faction', () => {
    const army = [
      { typeId: 'legionaries', count: 1 },
      { typeId: 'war-elephants', count: 1 },
    ];

    expect(validateScenario(scenario({ army }), DATA)).toEqual([
      'Player 0: unit type "legionaries" does not exist',
      'Player 0: unit type "war-elephants" does not belong to faction "rome"',
    ]);
    expect(validateScenario(scenario({ army: [] }), DATA)).toEqual([
      'Player 0: the army has no units',
    ]);
  });

  it('needs a whole positive number of units of every type', () => {
    for (const count of [0, -1, 1.5]) {
      expect(validateScenario(scenario({ army: [{ typeId: 'hastati', count }] }), DATA)).toEqual([
        `Player 0: the number of "hastati" units must be a positive integer, got ${count}`,
      ]);
    }
  });

  it('needs the camp on ground a unit can enter', () => {
    expect(validateScenario(scenario({ camp: RIVER }), DATA)).toEqual([
      `Player 0: the camp on ${hexKey(RIVER)} is not on passable ground`,
    ]);
    expect(validateScenario(scenario({}, { camp: rectangleHex(9, 9) }), DATA)).toEqual([
      `Player 1: the camp on ${hexKey(rectangleHex(9, 9))} is not on passable ground`,
    ]);
  });

  it('needs a deployment zone on the map, on passable ground and without repeats', () => {
    const offMap = rectangleHex(1, -1);
    const zone = [...ROME.deploymentZone, RIVER, offMap, rectangleHex(1, 0)];

    expect(validateScenario(scenario({ deploymentZone: zone }), DATA)).toEqual([
      'Player 0: the deployment zone lists a hex twice',
      `Player 0: deployment hex ${hexKey(RIVER)} is not on passable ground`,
      `Player 0: deployment hex ${hexKey(offMap)} is not on passable ground`,
    ]);
  });

  it('needs a deployment hex for every unit', () => {
    expect(
      validateScenario(scenario({ deploymentZone: ROME.deploymentZone.slice(1) }), DATA)
    ).toEqual(['Player 0: the deployment zone has 2 hexes for 3 units']);
  });

  it('keeps the two sides apart', () => {
    const shared = ROME.deploymentZone[0]!;

    expect(validateScenario(scenario({}, { camp: ROME.camp }), DATA)).toEqual([
      'Both camps are on the same hex',
    ]);
    expect(
      validateScenario(scenario({}, { deploymentZone: [...CARTHAGE.deploymentZone, shared] }), DATA)
    ).toEqual([`Hex ${hexKey(shared)} is in both deployment zones`]);
    expect(
      validateScenario(scenario({ deploymentZone: [...ROME.deploymentZone, CARTHAGE.camp] }), DATA)
    ).toEqual(["Player 0: the deployment zone contains the opponent's camp"]);
  });
});

describe('startScenario', () => {
  it('refuses a scenario that does not fit the data and says why', () => {
    expect(() => startScenario(scenario({ factionId: 'gaul' }), 1, DATA)).toThrow(
      'Scenario "test" cannot be played: Player 0: faction "gaul" does not exist'
    );
  });

  it('gives each side the army, camp and deployment zone of the scenario', () => {
    const { state, defs } = startScenario(scenario(), 1, DATA);

    expect(Object.values(state.units).map((unit) => [unit.id, unit.owner])).toEqual([
      ['p0-hastati-1', 0],
      ['p0-hastati-2', 0],
      ['p0-velites-1', 0],
      ['p1-war-elephants-1', 1],
    ]);
    expect(defs.camps).toEqual({ 0: ROME.camp, 1: CARTHAGE.camp });
    expect(defs.deploymentZones).toEqual({
      0: ROME.deploymentZone,
      1: CARTHAGE.deploymentZone,
    });
  });

  it('numbers units of one type through, however the army lists them', () => {
    const army = [
      { typeId: 'velites', count: 1 },
      { typeId: 'hastati', count: 1 },
      { typeId: 'velites', count: 1 },
    ];

    expect(Object.keys(startScenario(scenario({ army }), 1, DATA).state.units)).toEqual([
      'p0-velites-1',
      'p0-hastati-1',
      'p0-velites-2',
      'p1-war-elephants-1',
    ]);
  });

  it('turns the camp hexes into camps without touching the map in the data', () => {
    const { defs } = startScenario(scenario(), 1, DATA);

    expect(terrainAt(defs.map, defs.terrains, ROME.camp)?.id).toBe('camp');
    expect(terrainAt(defs.map, defs.terrains, CARTHAGE.camp)?.id).toBe('camp');
    expect(terrainAt(DATA.maps.field!, DATA.terrains, ROME.camp)?.id).toBe('plain');
  });

  it('builds the same definitions again for a loaded battle', () => {
    expect(scenarioDefs(scenario(), DATA)).toEqual(startScenario(scenario(), 1, DATA).defs);
    expect(() => scenarioDefs({ ...scenario(), mapId: 'atlantis' }, DATA)).toThrow(
      'Map "atlantis" does not exist'
    );
  });

  it('seeds the battle', () => {
    expect(startScenario(scenario(), 218, DATA).state.rng).toEqual({ seed: 218, state: 218 });
  });
});

describe('the factions in the data', () => {
  it('list exactly the unit types that name them as their faction', () => {
    for (const faction of Object.values(FACTIONS)) {
      const ownTypes = Object.values(UNIT_TYPES)
        .filter((unitType) => unitType.factionId === faction.id)
        .map((unitType) => unitType.id);

      expect([...faction.unitTypes].sort()).toEqual(ownTypes.sort());
    }
  });

  it('cover every unit type', () => {
    for (const unitType of Object.values(UNIT_TYPES)) {
      expect(Object.keys(FACTIONS)).toContain(unitType.factionId);
    }
  });

  it('are stored under their own id', () => {
    for (const [id, faction] of Object.entries(FACTIONS)) expect(faction.id).toBe(id);
  });
});

describe('the scenarios in the data', () => {
  const MIN_ARMY = 10;
  const MAX_ARMY = 14;

  it.each(Object.entries(SCENARIOS))('%s fits the data', (id, shipped) => {
    expect(shipped.id).toBe(id);
    expect(validateScenario(shipped, GAME_DATA)).toEqual([]);
  });

  it.each(Object.values(SCENARIOS))('$id gives both sides an army of 10 to 14 units', (shipped) => {
    for (const side of shipped.sides) {
      expect(armySize(side)).toBeGreaterThanOrEqual(MIN_ARMY);
      expect(armySize(side)).toBeLessThanOrEqual(MAX_ARMY);
    }
  });

  it('pit Rome against Carthage on the Trebia', () => {
    const { trebia } = SCENARIOS;

    expect(trebia?.sides.map((side) => side.factionId)).toEqual(['rome', 'carthage']);
    expect(trebia?.sides.map(armySize)).toEqual([12, 12]);
  });
});
