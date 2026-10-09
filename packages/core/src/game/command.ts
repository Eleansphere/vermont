import type { BattleState, Phase, PlayerSlot } from './battleState';

/** The active player hands the move over to the opponent. */
export interface EndTurnCommand {
  readonly type: 'EndTurn';
}

/** What a player wants to do. The core checks it and either carries it out or rejects it. */
export type Command = EndTurnCommand;

export type CommandType = Command['type'];

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

/** What happened; the renderer animates from events and the log lists them. */
export type GameEvent = TurnEndedEvent | TurnStartedEvent;

export type RejectionCode = 'unknownCommand' | 'wrongPhase' | 'battleEnded';

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
  validate?(state: BattleState, command: C): Rejection | null;
  /** Carries out a command that passed validation. Must not change `state`. */
  apply(state: BattleState, command: C): Outcome;
}

export type CommandHandlers = {
  readonly [T in CommandType]: CommandHandler<Extract<Command, { type: T }>>;
};
