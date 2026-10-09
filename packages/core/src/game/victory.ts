import type { BattleState, PlayerSlot, Winner } from './battleState';
import { opponentOf } from './battleState';
import type { Outcome } from './command';
import type { BattleDefs } from './rules';
import { fieldedUnits, isFighting, unitAt } from './unit';

/**
 * Who has won, if anybody: the side with a fighting unit in the opponent's camp, or the side
 * whose opponent has no unit left on the battlefield. The active player is checked first.
 */
export function findWinner(state: BattleState, defs: BattleDefs): Winner | undefined {
  const players = [state.activePlayer, opponentOf(state.activePlayer)];
  for (const player of players) {
    if (holdsEnemyCamp(state, defs, player)) return { player, reason: 'campCaptured' };
  }
  for (const player of players) {
    if (isArmyBroken(state, opponentOf(player))) return { player, reason: 'armyBroken' };
  }
  return undefined;
}

/** Ends the battle when the command that was just carried out decided it. */
export function concludeBattle(outcome: Outcome, defs: BattleDefs): Outcome {
  if (outcome.state.phase !== 'battle') return outcome;
  const winner = findWinner(outcome.state, defs);
  if (!winner) return outcome;
  return {
    state: { ...outcome.state, phase: 'ended', winner },
    events: [
      ...outcome.events,
      { type: 'BattleEnded', winner: winner.player, reason: winner.reason },
    ],
  };
}

function holdsEnemyCamp(state: BattleState, defs: BattleDefs, player: PlayerSlot): boolean {
  const camp = defs.camps[opponentOf(player)];
  const occupant = camp && unitAt(state, camp);
  return !!occupant && occupant.owner === player && isFighting(occupant);
}

/** An army that brought units to the battle and has none of them left on the field. */
function isArmyBroken(state: BattleState, player: PlayerSlot): boolean {
  const broughtUnits = Object.values(state.units).some((unit) => unit.owner === player);
  return broughtUnits && fieldedUnits(state, player).length === 0;
}
