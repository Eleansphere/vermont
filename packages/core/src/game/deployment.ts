import type { Hex, HexKey } from '../hex/hex';
import { hexEquals, hexKey } from '../hex/hex';
import { terrainAt } from '../map/battleMap';
import { terrainMoveCost } from '../map/terrain';
import type { BattleState, PlayerSlot } from './battleState';
import type { DeployUnitCommand, Rejection } from './command';
import type { BattleDefs } from './rules';
import type { Unit } from './unit';
import { fieldedUnits, unitHexes, unitTypeOf } from './unit';

/** Units of `player` that still wait to be deployed. */
export function reserveUnits(state: BattleState, player: PlayerSlot): Unit[] {
  return Object.values(state.units).filter(
    (unit) => unit.owner === player && unit.status === 'reserve'
  );
}

/** Why the unit cannot be deployed on the hex, or `null` when it can. */
export function checkDeployment(
  state: BattleState,
  defs: BattleDefs,
  unit: Unit,
  target: Hex
): Rejection | null {
  const key = hexKey(target);
  const zone = defs.deploymentZones[unit.owner] ?? [];
  if (!zone.some((zoneHex) => hexEquals(zoneHex, target))) {
    return {
      code: 'outsideDeploymentZone',
      message: `Hex ${key} is not in the deployment zone of player ${unit.owner}`,
    };
  }
  const terrain = terrainAt(defs.map, defs.terrains, target);
  if (!terrain || terrainMoveCost(terrain, unitTypeOf(defs, unit).archetype) === null) {
    return { code: 'impassable', message: `Unit "${unit.id}" cannot stand on hex ${key}` };
  }
  if (unitHexes(fieldedUnits(state)).has(key)) {
    return { code: 'hexOccupied', message: `Hex ${key} is occupied` };
  }
  return null;
}

/** Free hexes of its side's deployment zone the unit can be put on, in the zone's order. */
export function deploymentHexes(state: BattleState, defs: BattleDefs, unit: Unit): Hex[] {
  const zone = defs.deploymentZones[unit.owner] ?? [];
  return zone.filter((zoneHex) => checkDeployment(state, defs, unit, zoneHex) === null);
}

/**
 * Commands that deploy the units `player` still has in reserve: one after another, each on
 * the first free hex of the zone it can stand on. A unit with no hex left is not in the list.
 */
export function autoDeployment(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot = state.activePlayer
): DeployUnitCommand[] {
  const taken = new Set<HexKey>();
  const commands: DeployUnitCommand[] = [];
  for (const unit of reserveUnits(state, player)) {
    const free = deploymentHexes(state, defs, unit).find((zoneHex) => !taken.has(hexKey(zoneHex)));
    if (!free) continue;
    taken.add(hexKey(free));
    commands.push({ type: 'DeployUnit', unitId: unit.id, hex: free });
  }
  return commands;
}
