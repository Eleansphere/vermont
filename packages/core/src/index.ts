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
export { hexagonHexes, rectangleHex, rectangleHexes } from './map/shapes';
export { terrainMoveCost } from './map/terrain';
export type { TerrainDef, TerrainId, TerrainTable } from './map/terrain';
export { TERRAINS } from './data/terrains';

export { findPath, pathFromReach, reachableHexes, zoneOfControl } from './movement/movement';
export type { MoveContext, Path, Reach, ReachNode } from './movement/movement';

export { HILL_RANGE_BONUS, canSee, hasLineOfSight, rangeFrom, visibleHexes } from './sight/sight';
export type { SightContext } from './sight/sight';

export type {
  AbilityDef,
  AbilityId,
  AbilityTable,
  UnitTypeDef,
  UnitTypeTable,
} from './units/unitType';
export { ABILITIES } from './data/abilities';
export { RULES } from './data/rules';
export { UNIT_TYPES } from './data/unitTypes';

export type { FactionDef, FactionTable } from './scenario/faction';
export { armySize, validateScenario } from './scenario/scenario';
export type {
  ArmyEntry,
  GameData,
  MapTable,
  ScenarioDef,
  ScenarioSide,
  ScenarioTable,
} from './scenario/scenario';
export { scenarioDefs, startScenario } from './scenario/startScenario';
export type { StartedBattle } from './scenario/startScenario';
export { FACTIONS } from './data/factions';
export { GAME_DATA } from './data/gameData';
export { MAPS } from './data/maps';
export { SCENARIOS } from './data/scenarios';

export {
  FIRST_PLAYER,
  PHASES,
  PLAYER_SLOTS,
  VICTORY_REASONS,
  createBattle,
  opponentOf,
} from './game/battleState';
export type {
  BattleOptions,
  BattleState,
  Phase,
  PlayerSlot,
  VictoryReason,
  Winner,
} from './game/battleState';
export { createDefs } from './game/rules';
export type { BattleDefs, BattleRules, CombatRules, FogRules, MoraleRules } from './game/rules';
export {
  MORALE_STATES,
  UNIT_STATUSES,
  abilityOf,
  adjacentUnits,
  createUnits,
  fieldedUnits,
  isFielded,
  isFighting,
  moraleStateOf,
  unitAt,
  unitTypeOf,
} from './game/unit';
export type { FieldedUnit, MoraleState, Unit, UnitPlacement, UnitStatus } from './game/unit';
export { checkWalk, marchAlong, moveContextFor, unitReach } from './game/unitMovement';
export type { March, Walk } from './game/unitMovement';
export { eventsSeenBy, isFogLifted, playerSight, playerView, seesUnit } from './game/fog';
export type { PlayerView } from './game/fog';
export { attackKindFor, attackTargets, previewAttack } from './game/combat';
export type { AttackPreview, DamageRange } from './game/combat';
export { isEncircled } from './game/morale';
export { findWinner } from './game/victory';
export { autoDeployment, checkDeployment, deploymentHexes, reserveUnits } from './game/deployment';
export type {
  AttackCommand,
  AttackKind,
  AttackResolvedEvent,
  BattleEndedEvent,
  Command,
  CommandHandler,
  CommandHandlers,
  CommandType,
  DeployUnitCommand,
  DeploymentEndedEvent,
  EndDeploymentCommand,
  EndTurnCommand,
  GameEvent,
  MoraleChangedEvent,
  MoveUnitCommand,
  Outcome,
  PhaseChangedEvent,
  Rejection,
  RejectionCode,
  TurnEndedEvent,
  TurnStartedEvent,
  UnitAmbushedEvent,
  UnitDamagedEvent,
  UnitDeployedEvent,
  UnitDiedEvent,
  UnitFledEvent,
  UnitMovedEvent,
  UnitRalliedEvent,
  UnitRetreatedEvent,
  UnitsSwappedEvent,
  UseAbilityCommand,
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
