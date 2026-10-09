import { GAME_DATA } from '../data/gameData';
import type { BattleState } from '../game/battleState';
import { PLAYER_SLOTS, createBattle } from '../game/battleState';
import type { BattleDefs } from '../game/rules';
import type { UnitPlacement } from '../game/unit';
import { createUnits } from '../game/unit';
import { paintTerrain } from '../map/battleMap';
import type { GameData, ScenarioDef } from './scenario';
import { validateScenario } from './scenario';

/** A battle ready to be played: its state and the definitions `dispatch` needs with it. */
export interface StartedBattle {
  readonly state: BattleState;
  readonly defs: BattleDefs;
}

/**
 * Starts the scenario: both armies wait in reserve and the first player deploys. Throws when
 * the scenario does not fit the data, which is a mistake of its author, not of a player.
 */
export function startScenario(
  scenario: ScenarioDef,
  seed: number,
  data: GameData = GAME_DATA
): StartedBattle {
  const problems = validateScenario(scenario, data);
  if (problems.length > 0) {
    throw new Error(`Scenario "${scenario.id}" cannot be played: ${problems.join('; ')}`);
  }
  return {
    state: createBattle({
      scenarioId: scenario.id,
      seed,
      units: createUnits(data.unitTypes, data.rules.morale, armies(scenario)),
    }),
    defs: scenarioDefs(scenario, data),
  };
}

/** The definitions a battle of the scenario is played with; the same every time it is loaded. */
export function scenarioDefs(scenario: ScenarioDef, data: GameData = GAME_DATA): BattleDefs {
  const map = Object.hasOwn(data.maps, scenario.mapId) ? data.maps[scenario.mapId] : undefined;
  if (!map) throw new Error(`Map "${scenario.mapId}" does not exist`);

  const [first, second] = scenario.sides;
  return {
    map: paintTerrain(map, 'camp', [first.camp, second.camp]),
    terrains: data.terrains,
    unitTypes: data.unitTypes,
    abilities: data.abilities,
    rules: data.rules,
    camps: { 0: first.camp, 1: second.camp },
    deploymentZones: { 0: first.deploymentZone, 1: second.deploymentZone },
  };
}

/** Every unit of both armies, none of them on the map yet. */
function armies(scenario: ScenarioDef): UnitPlacement[] {
  return PLAYER_SLOTS.flatMap((owner) =>
    scenario.sides[owner].army.flatMap(({ typeId, count }) =>
      Array.from({ length: count }, () => ({ typeId, owner }))
    )
  );
}
