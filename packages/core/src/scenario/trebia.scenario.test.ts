import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { opponentOf } from '../game/battleState';
import type { Command } from '../game/command';
import { autoDeployment } from '../game/deployment';
import { dispatchAll } from '../game/dispatch';
import { deserializeBattle, serializeBattle } from '../game/serialize';
import { fight } from '../game/testGenerals';
import { play } from '../game/testSupport';
import { fieldedUnits, unitTypeOf } from '../game/unit';
import { hexKey } from '../hex/hex';
import { terrainMoveCost } from '../map/terrain';
import { terrainAt } from '../map/battleMap';
import { findPath } from '../movement/movement';
import type { StartedBattle } from './startScenario';
import { scenarioDefs, startScenario } from './startScenario';

const TREBIA = SCENARIOS.trebia!;
const END_DEPLOYMENT: Command = { type: 'EndDeployment' };

/** Both players line their armies up in the order the scenario lists them. */
function deploymentOf(start: StartedBattle): Command[] {
  const rome = [...autoDeployment(start.state, start.defs, 0), END_DEPLOYMENT];
  const afterRome = play(start, ...rome);
  return [...rome, ...autoDeployment(afterRome.state, afterRome.defs, 1), END_DEPLOYMENT];
}

function deployed(seed: number): StartedBattle {
  const start = startScenario(TREBIA, seed);
  return play(start, ...deploymentOf(start));
}

describe('scenario: Trebia', () => {
  it('is picked from the scenarios, deployed and started', () => {
    const start = startScenario(TREBIA, 218);
    const battle = play(start, ...deploymentOf(start));

    expect(start.state.phase).toBe('deployment');
    expect(battle.state).toMatchObject({ phase: 'battle', turn: 1, activePlayer: 0 });
    expect(fieldedUnits(battle.state, 0)).toHaveLength(12);
    expect(fieldedUnits(battle.state, 1)).toHaveLength(12);
  });

  it('lines both armies up in their front rows, cavalry on the wings', () => {
    const { state, defs } = deployed(218);
    const line = (player: 0 | 1) =>
      fieldedUnits(state, player)
        .sort((a, b) => a.pos.q - b.pos.q)
        .map((unit) => unitTypeOf(defs, unit).archetype);

    expect(new Set(fieldedUnits(state, 0).map((unit) => unit.pos.r))).toEqual(new Set([2]));
    expect(new Set(fieldedUnits(state, 1).map((unit) => unit.pos.r))).toEqual(new Set([9]));
    expect([line(0)[0], line(0).at(-1)]).toEqual(['cavalry', 'cavalry']);
    expect([line(1)[0], line(1).at(-1)]).toEqual(['lightCavalry', 'lightCavalry']);
  });

  it('has a way from each camp to the other for every kind of unit', () => {
    const { defs } = startScenario(TREBIA, 218);
    const archetypes = new Set(Object.values(defs.unitTypes).map((unitType) => unitType.archetype));

    for (const archetype of archetypes) {
      const route = findPath(defs.map, defs.camps[0]!, defs.camps[1]!, {
        terrains: defs.terrains,
        archetype,
      });
      expect(route, archetype).not.toBeNull();
    }
  });

  it('lets every unit stand anywhere in the deployment zone of its side', () => {
    const { state, defs } = startScenario(TREBIA, 218);

    for (const unit of Object.values(state.units)) {
      for (const zoneHex of defs.deploymentZones[unit.owner]!) {
        const terrain = terrainAt(defs.map, defs.terrains, zoneHex)!;
        expect(
          terrainMoveCost(terrain, unitTypeOf(defs, unit).archetype),
          `${unit.id} on ${hexKey(zoneHex)}`
        ).not.toBeNull();
      }
    }
  });

  it.each([218, 217, 216])('is fought to the end from seed %i', (seed) => {
    const battle = fight(deployed(seed));
    const { winner } = battle.state;

    expect(battle.state.phase).toBe('ended');
    expect(winner).toBeDefined();
    if (winner?.reason === 'armyBroken') {
      expect(fieldedUnits(battle.state, opponentOf(winner.player))).toEqual([]);
    }
  });

  it('plays out the same way again from the seed and the commands, deployment included', () => {
    const start = startScenario(TREBIA, 202);
    const deployment = deploymentOf(start);
    const fought = fight(play(start, ...deployment));

    const replay = dispatchAll(
      startScenario(TREBIA, 202).state,
      [...deployment, ...fought.commands],
      scenarioDefs(TREBIA)
    );

    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(fought.state);
  });

  it('survives a save in the middle, loaded with the definitions of its scenario', () => {
    const start = deployed(218);
    const whole = fight(start);
    const half = Math.floor(whole.commands.length / 2);

    const firstHalf = dispatchAll(start.state, whole.commands.slice(0, half), start.defs);
    const loaded = deserializeBattle(serializeBattle(firstHalf.state));
    const resumed = dispatchAll(
      loaded,
      whole.commands.slice(half),
      scenarioDefs(SCENARIOS[loaded.scenarioId]!)
    );

    expect(resumed.state).toEqual(whole.state);
  });
});
