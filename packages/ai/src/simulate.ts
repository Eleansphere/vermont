import type { BattleDefs, BattleState, Command, PlayerSlot, StartedBattle } from '@vermont/core';
import { autoDeployment, dispatch, playerView } from '@vermont/core';
import type { AiState } from './ai';
import { decide } from './decide';

/** A battle two computer players fought, for tests and for balancing. */
export interface SimulatedBattle {
  readonly state: BattleState;
  /** Every command that was carried out, in order; with the seed it replays the battle. */
  readonly commands: readonly Command[];
  /** Commands of the AIs the core refused. */
  readonly rejected: number;
}

const MAX_COMMANDS = 6000;

/**
 * What to do instead of an AI command the core refused, so that the battle goes on: the turn
 * ends, or the rest of the army is deployed the plain way. A refusal is rare but possible: a
 * shot can be blocked by a unit the shooter's side does not see.
 */
export function fallbackCommands(state: BattleState, defs: BattleDefs): Command[] {
  if (state.phase === 'deployment') {
    return [...autoDeployment(state, defs), { type: 'EndDeployment' }];
  }
  return state.phase === 'battle' ? [{ type: 'EndTurn' }] : [];
}

/**
 * Lets the two AIs play the battle out from where it stands. Each is given only its own view.
 * It stops when the battle is decided, or after `maxCommands` if it never is.
 */
export function simulateBattle(
  start: StartedBattle,
  players: Readonly<Record<PlayerSlot, AiState>>,
  maxCommands: number = MAX_COMMANDS
): SimulatedBattle {
  const { defs } = start;
  let state = start.state;
  let rejected = 0;
  const ais = { ...players };
  const commands: Command[] = [];
  const carryOut = (command: Command): boolean => {
    const result = dispatch(state, command, defs);
    if (!result.ok) return false;
    state = result.state;
    commands.push(command);
    return true;
  };

  while (state.phase !== 'ended' && commands.length < maxCommands) {
    const player = state.activePlayer;
    const decision = decide(playerView(state, defs, player), defs, ais[player]);
    ais[player] = decision.ai;
    if (carryOut(decision.command)) continue;

    rejected++;
    if (!fallbackCommands(state, defs).every(carryOut)) break;
  }
  return { state, commands, rejected };
}
