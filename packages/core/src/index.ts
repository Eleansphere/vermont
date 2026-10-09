export { RULES_VERSION } from './version';

export type { Archetype } from './archetype';

export {
  HEX_DIRECTIONS,
  hex,
  hexAdd,
  hexDistance,
  hexEquals,
  hexKey,
  hexLine,
  hexNeighbor,
  hexNeighbors,
  hexRing,
  hexRound,
  hexScale,
  hexSpiral,
  hexSubtract,
  parseHexKey,
} from './hex/hex';
export type { Hex, HexDirection, HexKey, LineSide } from './hex/hex';

export { createMap, hasHex, mapHexes, paintTerrain, terrainAt } from './map/battleMap';
export type { BattleMapDef, MapHex } from './map/battleMap';
export { hexagonHexes, rectangleHexes } from './map/shapes';
export { terrainMoveCost } from './map/terrain';
export type { TerrainDef, TerrainId, TerrainTable } from './map/terrain';
export { TERRAINS } from './data/terrains';

export { findPath, pathFromReach, reachableHexes, zoneOfControl } from './movement/movement';
export type { MoveContext, Path, Reach, ReachNode } from './movement/movement';

export { HILL_RANGE_BONUS, canSee, hasLineOfSight, rangeFrom, visibleHexes } from './sight/sight';
export type { SightContext } from './sight/sight';

export { PHASES, PLAYER_SLOTS, createBattle, opponentOf } from './game/battleState';
export type { BattleOptions, BattleState, Phase, PlayerSlot } from './game/battleState';
export type {
  Command,
  CommandHandler,
  CommandHandlers,
  CommandType,
  EndTurnCommand,
  GameEvent,
  Outcome,
  Rejection,
  RejectionCode,
  TurnEndedEvent,
  TurnStartedEvent,
} from './game/command';
export { COMMAND_HANDLERS, dispatch, dispatchAll } from './game/dispatch';
export type {
  Accepted,
  DispatchAllResult,
  DispatchResult,
  Rejected,
  RejectedAt,
} from './game/dispatch';
export { createRng, nextRandom, nextRandomInt } from './game/rng';
export type { Draw, RngState } from './game/rng';
export { deserializeBattle, serializeBattle } from './game/serialize';
export type { SavedBattle } from './game/serialize';
