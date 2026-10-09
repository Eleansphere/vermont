import { PLAYER_SLOTS, opponentOf } from '../game/battleState';
import type { BattleRules } from '../game/rules';
import type { Hex, HexKey } from '../hex/hex';
import { hexEquals, hexKey } from '../hex/hex';
import type { BattleMapDef } from '../map/battleMap';
import { terrainAt } from '../map/battleMap';
import type { TerrainTable } from '../map/terrain';
import type { AbilityTable, UnitTypeTable } from '../units/unitType';
import type { FactionTable } from './faction';

/** Some number of units of one type in an army. */
export interface ArmyEntry {
  readonly typeId: string;
  readonly count: number;
}

export interface ScenarioSide {
  readonly factionId: string;
  /** The army the scenario gives the side, in the order its units are listed and deployed. */
  readonly army: readonly ArmyEntry[];
  /** The side's camp; the opponent wins by entering it. */
  readonly camp: Hex;
  /** Hexes the side may deploy on, the ones to fill first at the front of the list. */
  readonly deploymentZone: readonly Hex[];
}

/** One battle to play: where it is fought, by whom and with what. */
export interface ScenarioDef {
  readonly id: string;
  readonly name: string;
  readonly mapId: string;
  /** The two sides by player slot. */
  readonly sides: readonly [ScenarioSide, ScenarioSide];
}

export type ScenarioTable = Readonly<Record<string, ScenarioDef>>;

export type MapTable = Readonly<Record<string, BattleMapDef>>;

/** All the definitions scenarios are built from and battles are played with. */
export interface GameData {
  readonly maps: MapTable;
  readonly factions: FactionTable;
  readonly terrains: TerrainTable;
  readonly unitTypes: UnitTypeTable;
  readonly abilities: AbilityTable;
  readonly rules: BattleRules;
}

/** How many units the side brings to the battle. */
export function armySize(side: ScenarioSide): number {
  return side.army.reduce((size, entry) => size + entry.count, 0);
}

/**
 * Everything wrong with the scenario, in words meant for whoever wrote it; an empty list means
 * a battle can be started from it.
 */
export function validateScenario(scenario: ScenarioDef, data: GameData): string[] {
  const map = Object.hasOwn(data.maps, scenario.mapId) ? data.maps[scenario.mapId] : undefined;
  if (!map) return [`Map "${scenario.mapId}" does not exist`];

  const canStandOn = (target: Hex) => {
    const terrain = terrainAt(map, data.terrains, target);
    return !!terrain && terrain.moveCost !== null;
  };
  const [first, second] = scenario.sides;
  const problems: string[] = [];
  for (const player of PLAYER_SLOTS) {
    const side = scenario.sides[player];
    const zone = new Set(side.deploymentZone.map(hexKey));
    const sideProblems = armyProblems(side, data);

    if (!canStandOn(side.camp)) {
      sideProblems.push(`the camp on ${hexKey(side.camp)} is not on passable ground`);
    }
    if (zone.size !== side.deploymentZone.length) {
      sideProblems.push('the deployment zone lists a hex twice');
    }
    for (const zoneHex of side.deploymentZone) {
      if (!canStandOn(zoneHex)) {
        sideProblems.push(`deployment hex ${hexKey(zoneHex)} is not on passable ground`);
      }
    }
    if (zone.size < armySize(side)) {
      sideProblems.push(`the deployment zone has ${zone.size} hexes for ${armySize(side)} units`);
    }
    if (zone.has(hexKey(scenario.sides[opponentOf(player)].camp))) {
      sideProblems.push("the deployment zone contains the opponent's camp");
    }
    problems.push(...sideProblems.map((problem) => `Player ${player}: ${problem}`));
  }
  if (hexEquals(first.camp, second.camp)) problems.push('Both camps are on the same hex');
  const firstZone = new Set<HexKey>(first.deploymentZone.map(hexKey));
  const shared = second.deploymentZone.find((zoneHex) => firstZone.has(hexKey(zoneHex)));
  if (shared) problems.push(`Hex ${hexKey(shared)} is in both deployment zones`);
  return problems;
}

function armyProblems(side: ScenarioSide, data: GameData): string[] {
  const faction = Object.hasOwn(data.factions, side.factionId)
    ? data.factions[side.factionId]
    : undefined;
  if (!faction) return [`faction "${side.factionId}" does not exist`];

  const problems: string[] = [];
  if (side.army.length === 0) problems.push('the army has no units');
  for (const { typeId, count } of side.army) {
    if (!Number.isInteger(count) || count < 1) {
      problems.push(`the number of "${typeId}" units must be a positive integer, got ${count}`);
    }
    if (!Object.hasOwn(data.unitTypes, typeId)) {
      problems.push(`unit type "${typeId}" does not exist`);
    } else if (!faction.unitTypes.includes(typeId)) {
      problems.push(`unit type "${typeId}" does not belong to faction "${faction.id}"`);
    }
  }
  return problems;
}
