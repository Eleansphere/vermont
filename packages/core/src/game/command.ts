import type { Hex } from '../hex/hex';
import type { AbilityId } from '../units/unitType';
import type { BattleState, Phase, PlayerSlot, VictoryReason } from './battleState';
import type { BattleDefs } from './rules';
import type { MoraleState } from './unit';

/** The active player hands the move over to the opponent. */
export interface EndTurnCommand {
  readonly type: 'EndTurn';
}

/**
 * Moves a unit along `path`, which starts on the unit's hex and ends where it should stop. The
 * path is checked against what the player knows; an enemy hidden in the fog stops the unit on
 * the way.
 */
export interface MoveUnitCommand {
  readonly type: 'MoveUnit';
  readonly unitId: string;
  readonly path: readonly Hex[];
}

/** Attacks an enemy unit: hand to hand when it is adjacent, by shooting when it is further. */
export interface AttackCommand {
  readonly type: 'Attack';
  readonly unitId: string;
  readonly targetId: string;
}

/** Uses an ability that has to be ordered, such as swapping places with `targetId`. */
export interface UseAbilityCommand {
  readonly type: 'UseAbility';
  readonly unitId: string;
  readonly abilityId: AbilityId;
  readonly targetId?: string;
}

/**
 * Puts a unit on a hex of its side's deployment zone before the battle. A unit that already
 * stands in the zone is moved.
 */
export interface DeployUnitCommand {
  readonly type: 'DeployUnit';
  readonly unitId: string;
  readonly hex: Hex;
}

/** The active player is done deploying; after the second player the battle starts. */
export interface EndDeploymentCommand {
  readonly type: 'EndDeployment';
}

/** What a player wants to do. The core checks it and either carries it out or rejects it. */
export type Command =
  | DeployUnitCommand
  | EndDeploymentCommand
  | EndTurnCommand
  | MoveUnitCommand
  | AttackCommand
  | UseAbilityCommand;

export type CommandType = Command['type'];

export interface UnitDeployedEvent {
  readonly type: 'UnitDeployed';
  readonly unitId: string;
  readonly hex: Hex;
  /** Where the unit stood before; `null` when it came from the reserve. */
  readonly from: Hex | null;
}

export interface DeploymentEndedEvent {
  readonly type: 'DeploymentEnded';
  readonly player: PlayerSlot;
}

export interface PhaseChangedEvent {
  readonly type: 'PhaseChanged';
  readonly phase: Phase;
}

export interface TurnEndedEvent {
  readonly type: 'TurnEnded';
  readonly player: PlayerSlot;
  readonly turn: number;
}

export interface TurnStartedEvent {
  readonly type: 'TurnStarted';
  readonly player: PlayerSlot;
  readonly turn: number;
}

export interface UnitMovedEvent {
  readonly type: 'UnitMoved';
  readonly unitId: string;
  /** Hexes walked through, from the starting hex to the final one. */
  readonly path: readonly Hex[];
  readonly cost: number;
}

/**
 * A unit ran into an enemy its player did not know about and had to stop on `hex`, short of
 * where it was sent.
 */
export interface UnitAmbushedEvent {
  readonly type: 'UnitAmbushed';
  readonly unitId: string;
  readonly hex: Hex;
}

export type AttackKind = 'melee' | 'ranged';

export interface AttackResolvedEvent {
  readonly type: 'AttackResolved';
  readonly attackerId: string;
  readonly targetId: string;
  readonly kind: AttackKind;
  readonly damage: number;
  /** Damage the attacker took in return; `null` when the target did not strike back. */
  readonly counterDamage: number | null;
}

export interface UnitDamagedEvent {
  readonly type: 'UnitDamaged';
  readonly unitId: string;
  readonly damage: number;
  /** Health left after the damage. */
  readonly hp: number;
}

export interface UnitDiedEvent {
  readonly type: 'UnitDied';
  readonly unitId: string;
  readonly hex: Hex;
}

export interface MoraleChangedEvent {
  readonly type: 'MoraleChanged';
  readonly unitId: string;
  readonly morale: number;
  readonly moraleState: MoraleState;
}

/** Two units of one side changed places. */
export interface UnitsSwappedEvent {
  readonly type: 'UnitsSwapped';
  readonly unitId: string;
  readonly targetId: string;
}

/** A routing unit ran from the enemy; the path is a single hex when it had nowhere to go. */
export interface UnitRetreatedEvent {
  readonly type: 'UnitRetreated';
  readonly unitId: string;
  readonly path: readonly Hex[];
}

/** A routing unit pulled itself together and can be commanded again. */
export interface UnitRalliedEvent {
  readonly type: 'UnitRallied';
  readonly unitId: string;
}

/** A routing unit left the battlefield for good. */
export interface UnitFledEvent {
  readonly type: 'UnitFled';
  readonly unitId: string;
  readonly hex: Hex;
}

export interface BattleEndedEvent {
  readonly type: 'BattleEnded';
  readonly winner: PlayerSlot;
  readonly reason: VictoryReason;
}

/** What happened; the renderer animates from events and the log lists them. */
export type GameEvent =
  | UnitDeployedEvent
  | DeploymentEndedEvent
  | PhaseChangedEvent
  | TurnEndedEvent
  | TurnStartedEvent
  | UnitMovedEvent
  | UnitAmbushedEvent
  | AttackResolvedEvent
  | UnitDamagedEvent
  | UnitDiedEvent
  | MoraleChangedEvent
  | UnitsSwappedEvent
  | UnitRetreatedEvent
  | UnitRalliedEvent
  | UnitFledEvent
  | BattleEndedEvent;

export type RejectionCode =
  | 'unknownCommand'
  | 'wrongPhase'
  | 'battleEnded'
  | 'unknownUnit'
  | 'notYourUnit'
  | 'unitNotOnField'
  | 'unitRouting'
  | 'invalidPath'
  | 'impassable'
  | 'hexOccupied'
  | 'zoneOfControl'
  | 'notEnoughMovement'
  | 'alreadyAttacked'
  | 'invalidTarget'
  | 'engaged'
  | 'outOfRange'
  | 'noLineOfSight'
  | 'abilityUnavailable'
  | 'invalidHex'
  | 'outsideDeploymentZone'
  | 'unitsNotDeployed';

/** Why a command was not carried out. The UI translates `code`; `message` is for logs. */
export interface Rejection {
  readonly code: RejectionCode;
  readonly message: string;
}

/** A carried-out command: the state after it and what happened on the way. */
export interface Outcome {
  readonly state: BattleState;
  readonly events: readonly GameEvent[];
}

/** Rules of one command type. */
export interface CommandHandler<C extends Command = Command> {
  /** Phases in which the command is allowed. */
  readonly phases: readonly Phase[];
  /** Checks specific to the command; returns `null` when it may be carried out. */
  validate?(state: BattleState, command: C, defs: BattleDefs): Rejection | null;
  /** Carries out a command that passed validation. Must not change `state`. */
  apply(state: BattleState, command: C, defs: BattleDefs): Outcome;
}

export type CommandHandlers = {
  readonly [T in CommandType]: CommandHandler<Extract<Command, { type: T }>>;
};
