import type { BattleState } from './battleState';
import type {
  Command,
  CommandHandler,
  CommandHandlers,
  GameEvent,
  Outcome,
  Rejection,
} from './command';
import { attack } from './handlers/attack';
import { endTurn } from './handlers/endTurn';
import { moveUnit } from './handlers/moveUnit';
import { useAbility } from './handlers/useAbility';
import type { BattleDefs } from './rules';
import { concludeBattle } from './victory';

/** Every command the core understands; a new command is added by registering its handler. */
export const COMMAND_HANDLERS: CommandHandlers = {
  EndTurn: endTurn,
  MoveUnit: moveUnit,
  Attack: attack,
  UseAbility: useAbility,
};

export interface Accepted extends Outcome {
  readonly ok: true;
}

/** A refused command; `state` is the untouched state the command was sent to. */
export interface Rejected {
  readonly ok: false;
  readonly state: BattleState;
  readonly rejection: Rejection;
}

export type DispatchResult = Accepted | Rejected;

/** A list of commands that stopped at the first rejected one. */
export interface RejectedAt extends Rejected {
  /** Events of the commands carried out before the rejected one. */
  readonly events: readonly GameEvent[];
  /** Position of the rejected command in the list. */
  readonly commandIndex: number;
}

export type DispatchAllResult = Accepted | RejectedAt;

/**
 * Checks the command against the rules and carries it out. The given state is never changed:
 * an accepted command returns a new state and its events, a rejected one the same state and
 * the reason. A command that decides the battle also ends it.
 */
export function dispatch(state: BattleState, command: Command, defs: BattleDefs): DispatchResult {
  const handler = findHandler(command);
  if (!handler) {
    return { ok: false, state, rejection: unknownCommand(command) };
  }
  const rejection =
    rejectPhase(state, command, handler) ?? handler.validate?.(state, command, defs);
  if (rejection) {
    return { ok: false, state, rejection };
  }
  return { ok: true, ...concludeBattle(handler.apply(state, command, defs), defs) };
}

/**
 * Carries out the commands one after another, as a replay or a scenario test does. Stops at
 * the first rejected command and returns the state reached until then.
 */
export function dispatchAll(
  state: BattleState,
  commands: readonly Command[],
  defs: BattleDefs
): DispatchAllResult {
  let current = state;
  const events: GameEvent[] = [];
  for (const [commandIndex, command] of commands.entries()) {
    const result = dispatch(current, command, defs);
    if (!result.ok) {
      return { ...result, events, commandIndex };
    }
    current = result.state;
    events.push(...result.events);
  }
  return { ok: true, state: current, events };
}

/** Commands can arrive from a save file or over the wire, so the type is checked at run time. */
function findHandler(command: Command): CommandHandler | undefined {
  const type: unknown = (command as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !Object.hasOwn(COMMAND_HANDLERS, type)) return undefined;
  return COMMAND_HANDLERS[type as keyof CommandHandlers] as CommandHandler;
}

function rejectPhase(
  state: BattleState,
  command: Command,
  handler: CommandHandler
): Rejection | null {
  if (handler.phases.includes(state.phase)) return null;
  if (state.phase === 'ended') {
    return { code: 'battleEnded', message: `${command.type} is not possible, the battle is over` };
  }
  return {
    code: 'wrongPhase',
    message: `${command.type} is not possible in the ${state.phase} phase`,
  };
}

function unknownCommand(command: Command): Rejection {
  const type: unknown = (command as { type?: unknown } | null)?.type;
  return { code: 'unknownCommand', message: `Unknown command: ${JSON.stringify(type)}` };
}
