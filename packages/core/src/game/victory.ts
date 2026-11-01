import type { BattleState, PlayerSlot, Winner } from './battleState';
import { opponentOf } from './battleState';
import type { Outcome } from './command';
import { isGeneral } from './generals';
import type { BattleDefs } from './rules';
import { fieldedUnits, isFighting, unitAt } from './unit';

/**
 * Who has won by breaking the opponent's army, if anybody; the active player is checked first.
 * A camp falls only when a turn ends, see `EndTurn`.
 */
export function findWinner(state: BattleState, defs: BattleDefs): Winner | undefined {
  const players = [state.activePlayer, opponentOf(state.activePlayer)];
  for (const player of players) {
    if (isArmyBroken(state, defs, opponentOf(player))) return { player, reason: 'armyBroken' };
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

/** Whether a unit of `player` that still fights stands in the opponent's camp. */
export function holdsEnemyCamp(state: BattleState, defs: BattleDefs, player: PlayerSlot): boolean {
  const camp = defs.camps[opponentOf(player)];
  const occupant = camp && unitAt(state, camp);
  return !!occupant && occupant.owner === player && isFighting(occupant);
}

/** How an army stands against breaking: what it brought and what it has lost for good. */
export interface ArmyLosses {
  readonly brought: number;
  /** Units destroyed or fled from the field. */
  readonly lost: number;
  /** Units it can lose before it breaks. */
  readonly untilBreak: number;
}

export function armyLosses(state: BattleState, defs: BattleDefs, player: PlayerSlot): ArmyLosses {
  // The general is not counted: his fall costs the army its heart, not a unit of its line.
  const army = Object.values(state.units).filter(
    (unit) => unit.owner === player && !isGeneral(defs, unit)
  );
  const lost = army.filter((unit) => unit.status === 'dead' || unit.status === 'fled').length;
  const breaksAt = Math.max(1, Math.ceil(army.length * defs.rules.victory.armyBreaksAt));
  return { brought: army.length, lost, untilBreak: Math.max(0, breaksAt - lost) };
}

/**
 * An army that brought units to the battle and has lost so many of them that it breaks, or has
 * none of them left on the field.
 */
function isArmyBroken(state: BattleState, defs: BattleDefs, player: PlayerSlot): boolean {
  const { brought, untilBreak } = armyLosses(state, defs, player);
  return brought > 0 && (untilBreak === 0 || fieldedUnits(state, player).length === 0);
}
