import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import { opponentOf } from '../game/battleState';
import type { Command } from '../game/command';
import { autoDeployment } from '../game/deployment';
import { dispatchAll } from '../game/dispatch';
import { fight } from '../game/testGenerals';
import { play } from '../game/testSupport';
import { fieldedUnits, unitTypeOf } from '../game/unit';
import { hexKey } from '../hex/hex';
import { terrainAt } from '../map/battleMap';
import { terrainMoveCost } from '../map/terrain';
import { findPath } from '../movement/movement';
import type { ScenarioDef } from './scenario';
import { armySize } from './scenario';
import type { StartedBattle } from './startScenario';
import { scenarioDefs, startScenario } from './startScenario';

const END_DEPLOYMENT: Command = { type: 'EndDeployment' };
const SEEDS = [218, 216, 202];
const REPLAY_SEED = 202;

/** Both players line their armies up in the order the scenario lists them. */
function deploymentOf(start: StartedBattle): Command[] {
  const first = [...autoDeployment(start.state, start.defs, 0), END_DEPLOYMENT];
  const afterFirst = play(start, ...first);
  return [...first, ...autoDeployment(afterFirst.state, afterFirst.defs, 1), END_DEPLOYMENT];
}

describe.each(Object.values(SCENARIOS))('scenario in the data: $id', (scenario: ScenarioDef) => {
  it('is deployed and started', () => {
    const start = startScenario(scenario, REPLAY_SEED);
    const battle = play(start, ...deploymentOf(start));

    expect(battle.state).toMatchObject({ phase: 'battle', turn: 1, activePlayer: 0 });
    expect(fieldedUnits(battle.state, 0)).toHaveLength(armySize(scenario.sides[0]));
    expect(fieldedUnits(battle.state, 1)).toHaveLength(armySize(scenario.sides[1]));
  });

  it('has a way from each camp to the other for every kind of unit', () => {
    const { defs } = startScenario(scenario, REPLAY_SEED);
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
    const { state, defs } = startScenario(scenario, REPLAY_SEED);

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

  it.each(SEEDS)('is fought to the end from seed %i', (seed) => {
    const start = startScenario(scenario, seed);
    const battle = fight(play(start, ...deploymentOf(start)));
    const { winner } = battle.state;

    expect(battle.state.phase).toBe('ended');
    expect(winner).toBeDefined();
    if (winner?.reason === 'armyBroken') {
      expect(fieldedUnits(battle.state, opponentOf(winner.player))).toEqual([]);
    }
  });

  it('plays out the same way again from the seed and the commands, deployment included', () => {
    const start = startScenario(scenario, REPLAY_SEED);
    const deployment = deploymentOf(start);
    const fought = fight(play(start, ...deployment));

    const replay = dispatchAll(
      startScenario(scenario, REPLAY_SEED).state,
      [...deployment, ...fought.commands],
      scenarioDefs(scenario)
    );

    expect(replay.ok).toBe(true);
    expect(replay.state).toEqual(fought.state);
  });
});
