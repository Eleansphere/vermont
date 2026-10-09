import { describe, expect, it } from 'vitest';
import { GAME_DATA } from '../data/gameData';
import { createMap, paintTerrain } from '../map/battleMap';
import { rectangleHex, rectangleHexes } from '../map/shapes';
import type { GameData, ScenarioDef } from '../scenario/scenario';
import { startScenario } from '../scenario/startScenario';
import type { Command } from './command';
import { autoDeployment, deploymentHexes, reserveUnits } from './deployment';
import { deserializeBattle, serializeBattle } from './serialize';
import type { TestBattle } from './testSupport';
import { END_TURN, play, rejectionOf, unitOf } from './testSupport';
import { fieldedUnits } from './unit';

const MOUNTAIN = rectangleHex(3, 0);

/** A small field: Rome deploys in the top row, Carthage in the bottom one. */
const DATA: GameData = {
  ...GAME_DATA,
  maps: { field: paintTerrain(createMap('field', rectangleHexes(6, 6)), 'mountain', [MOUNTAIN]) },
};

const SKIRMISH: ScenarioDef = {
  id: 'skirmish',
  name: 'Skirmish',
  mapId: 'field',
  sides: [
    {
      factionId: 'rome',
      army: [
        { typeId: 'hastati', count: 2 },
        { typeId: 'equites', count: 1 },
      ],
      camp: rectangleHex(5, 0),
      deploymentZone: [0, 1, 2, 3].map((column) => rectangleHex(column, 0)),
    },
    {
      factionId: 'carthage',
      army: [
        { typeId: 'libyan-spearmen', count: 1 },
        { typeId: 'numidian-cavalry', count: 1 },
      ],
      camp: rectangleHex(5, 5),
      deploymentZone: [0, 1, 2, 3].map((column) => rectangleHex(column, 5)),
    },
  ],
};

const END_DEPLOYMENT: Command = { type: 'EndDeployment' };

function skirmish(): TestBattle {
  return startScenario(SKIRMISH, 7, DATA);
}

function deploy(unitId: string, column: number, row: number): Command {
  return { type: 'DeployUnit', unitId, hex: rectangleHex(column, row) };
}

/** Rome stands on the field and it is Carthage's turn to deploy. */
function romeDeployed(): TestBattle {
  const battle = skirmish();
  return play(battle, ...autoDeployment(battle.state, battle.defs), END_DEPLOYMENT);
}

function bothDeployed(): TestBattle {
  const battle = romeDeployed();
  return play(battle, ...autoDeployment(battle.state, battle.defs), END_DEPLOYMENT);
}

describe('the start of a scenario', () => {
  it('has both armies in reserve and the first player deploying', () => {
    const { state } = skirmish();

    expect(state).toMatchObject({ scenarioId: 'skirmish', phase: 'deployment', activePlayer: 0 });
    expect(Object.keys(state.units)).toEqual([
      'p0-hastati-1',
      'p0-hastati-2',
      'p0-equites-1',
      'p1-libyan-spearmen-1',
      'p1-numidian-cavalry-1',
    ]);
    expect(fieldedUnits(state)).toEqual([]);
    expect(reserveUnits(state, 0)).toHaveLength(3);
    expect(reserveUnits(state, 1)).toHaveLength(2);
  });

  it('gives every unit the full health and morale of its type', () => {
    expect(unitOf(skirmish(), 'p0-hastati-1')).toMatchObject({
      typeId: 'hastati',
      owner: 0,
      pos: null,
      status: 'reserve',
      hp: 10,
      morale: 7,
      movementLeft: 4,
    });
  });
});

describe('DeployUnit', () => {
  it('puts a unit from the reserve on a hex of its zone', () => {
    const played = play(skirmish(), deploy('p0-hastati-1', 1, 0));

    expect(unitOf(played, 'p0-hastati-1')).toMatchObject({
      pos: rectangleHex(1, 0),
      status: 'active',
    });
    expect(played.events).toEqual([
      { type: 'UnitDeployed', unitId: 'p0-hastati-1', hex: rectangleHex(1, 0), from: null },
    ]);
    expect(reserveUnits(played.state, 0)).toHaveLength(2);
  });

  it('moves a unit that already stands in the zone', () => {
    const played = play(skirmish(), deploy('p0-hastati-1', 1, 0), deploy('p0-hastati-1', 2, 0));

    expect(unitOf(played, 'p0-hastati-1').pos).toEqual(rectangleHex(2, 0));
    expect(played.events.at(-1)).toEqual({
      type: 'UnitDeployed',
      unitId: 'p0-hastati-1',
      hex: rectangleHex(2, 0),
      from: rectangleHex(1, 0),
    });
  });

  it('does not change the state it was given', () => {
    const battle = skirmish();
    const before = serializeBattle(battle.state);

    play(battle, deploy('p0-hastati-1', 1, 0));

    expect(serializeBattle(battle.state)).toBe(before);
  });

  it('refuses a unit that does not exist or belongs to the other player', () => {
    expect(rejectionOf(skirmish(), deploy('p0-triarii-1', 1, 0))).toBe('unknownUnit');
    expect(rejectionOf(skirmish(), deploy('p1-libyan-spearmen-1', 1, 5))).toBe('notYourUnit');
  });

  it('refuses a hex outside the zone of the unit', () => {
    expect(rejectionOf(skirmish(), deploy('p0-hastati-1', 1, 1))).toBe('outsideDeploymentZone');
    expect(rejectionOf(skirmish(), deploy('p0-hastati-1', 1, 5))).toBe('outsideDeploymentZone');
    expect(rejectionOf(skirmish(), deploy('p0-hastati-1', 9, 9))).toBe('outsideDeploymentZone');
  });

  it('refuses something that is not a hex', () => {
    const broken = { type: 'DeployUnit', unitId: 'p0-hastati-1', hex: { q: 0.5 } } as Command;
    const missing = { type: 'DeployUnit', unitId: 'p0-hastati-1' } as Command;

    expect(rejectionOf(skirmish(), broken)).toBe('invalidHex');
    expect(rejectionOf(skirmish(), missing)).toBe('invalidHex');
  });

  it('refuses a hex another unit stands on', () => {
    const battle = play(skirmish(), deploy('p0-hastati-1', 1, 0));

    expect(rejectionOf(battle, deploy('p0-hastati-2', 1, 0))).toBe('hexOccupied');
  });

  it('refuses terrain the unit cannot enter', () => {
    const onMountain = { column: 3, row: 0 };

    expect(rejectionOf(skirmish(), deploy('p0-equites-1', onMountain.column, onMountain.row))).toBe(
      'impassable'
    );
    expect(
      rejectionOf(skirmish(), deploy('p0-hastati-1', onMountain.column, onMountain.row))
    ).toBeNull();
  });

  it('is not possible once the battle has started', () => {
    expect(rejectionOf(bothDeployed(), deploy('p0-hastati-1', 0, 0))).toBe('wrongPhase');
  });
});

describe('EndDeployment', () => {
  it('waits until the whole army is deployed', () => {
    const battle = play(skirmish(), deploy('p0-hastati-1', 0, 0), deploy('p0-hastati-2', 1, 0));

    expect(rejectionOf(battle, END_DEPLOYMENT)).toBe('unitsNotDeployed');
  });

  it('hands the deployment over to the second player', () => {
    const battle = skirmish();
    const played = play(battle, ...autoDeployment(battle.state, battle.defs), END_DEPLOYMENT);

    expect(played.state).toMatchObject({ phase: 'deployment', activePlayer: 1, turn: 1 });
    expect(played.events.at(-1)).toEqual({ type: 'DeploymentEnded', player: 0 });
    expect(rejectionOf(played, deploy('p0-hastati-1', 3, 0))).toBe('notYourUnit');
  });

  it('starts the battle after the second player, with the first one to move', () => {
    const battle = romeDeployed();
    const played = play(battle, ...autoDeployment(battle.state, battle.defs), END_DEPLOYMENT);

    expect(played.state).toMatchObject({ phase: 'battle', activePlayer: 0, turn: 1 });
    expect(played.state.winner).toBeUndefined();
    expect(played.events.slice(-3)).toEqual([
      { type: 'DeploymentEnded', player: 1 },
      { type: 'PhaseChanged', phase: 'battle' },
      { type: 'TurnStarted', player: 0, turn: 1 },
    ]);
  });

  it('is not possible once the battle has started', () => {
    expect(rejectionOf(bothDeployed(), END_DEPLOYMENT)).toBe('wrongPhase');
  });
});

describe('the deployment phase', () => {
  it('takes no battle orders', () => {
    const battle = play(skirmish(), deploy('p0-hastati-1', 1, 0));
    const march: Command = {
      type: 'MoveUnit',
      unitId: 'p0-hastati-1',
      path: [rectangleHex(1, 0), rectangleHex(1, 1)],
    };

    expect(rejectionOf(battle, march)).toBe('wrongPhase');
    expect(rejectionOf(battle, END_TURN)).toBe('wrongPhase');
  });

  it('leaves the deployed units ready to move in the battle', () => {
    const battle = bothDeployed();
    const [first] = fieldedUnits(battle.state, 0);
    const march: Command = {
      type: 'MoveUnit',
      unitId: first!.id,
      path: [first!.pos, rectangleHex(0, 1)],
    };

    expect(fieldedUnits(battle.state)).toHaveLength(5);
    expect(rejectionOf(battle, march)).toBeNull();
  });

  it('survives a save and load', () => {
    const battle = play(skirmish(), deploy('p0-hastati-1', 1, 0));
    const loaded = deserializeBattle(serializeBattle(battle.state));

    expect(loaded).toEqual(battle.state);
    expect(rejectionOf({ ...battle, state: loaded }, deploy('p0-hastati-2', 2, 0))).toBeNull();
  });
});

describe('deploymentHexes', () => {
  it('lists the free hexes of the zone the unit can stand on', () => {
    const battle = play(skirmish(), deploy('p0-hastati-1', 1, 0));

    expect(deploymentHexes(battle.state, battle.defs, unitOf(battle, 'p0-hastati-2'))).toEqual([
      rectangleHex(0, 0),
      rectangleHex(2, 0),
      MOUNTAIN,
    ]);
    expect(deploymentHexes(battle.state, battle.defs, unitOf(battle, 'p0-equites-1'))).toEqual([
      rectangleHex(0, 0),
      rectangleHex(2, 0),
    ]);
  });
});

describe('autoDeployment', () => {
  it('fills the zone from its first hex in the order of the army', () => {
    const battle = skirmish();

    expect(autoDeployment(battle.state, battle.defs)).toEqual([
      deploy('p0-hastati-1', 0, 0),
      deploy('p0-hastati-2', 1, 0),
      deploy('p0-equites-1', 2, 0),
    ]);
  });

  it('deploys only the units still in reserve, around those already placed', () => {
    const battle = play(skirmish(), deploy('p0-hastati-2', 0, 0));

    expect(autoDeployment(battle.state, battle.defs)).toEqual([
      deploy('p0-hastati-1', 1, 0),
      deploy('p0-equites-1', 2, 0),
    ]);
  });

  it('leaves out a unit that has no hex to stand on', () => {
    const battle = play(
      skirmish(),
      deploy('p0-hastati-1', 0, 0),
      deploy('p0-hastati-2', 1, 0),
      deploy('p0-hastati-1', 2, 0),
      deploy('p0-hastati-2', 0, 0)
    );
    const crowded = play(battle, deploy('p0-hastati-1', 1, 0));
    const full = {
      ...crowded,
      defs: {
        ...crowded.defs,
        deploymentZones: { 0: [rectangleHex(0, 0), rectangleHex(1, 0), MOUNTAIN] },
      },
    };

    expect(autoDeployment(full.state, full.defs)).toEqual([]);
  });

  it('can deploy the army of the player who is not on the move', () => {
    const battle = skirmish();

    expect(autoDeployment(battle.state, battle.defs, 1)).toEqual([
      deploy('p1-libyan-spearmen-1', 0, 5),
      deploy('p1-numidian-cavalry-1', 1, 5),
    ]);
  });
});
