import type { PlayerSlot, ScenarioDef } from '@vermont/core';
import { opponentOf, startScenario } from '@vermont/core';
import type { Difficulty } from './ai';
import { createAi } from './ai';
import type { SimulatedBattle } from './simulate';
import { simulateBattle } from './simulate';

/** Keeps the two players' dice apart when both start from the seed of the battle. */
const SECOND_PLAYER_SEED = 1000;
/** Rounds after the first clash that show how hard the first blows hit the loser. */
const OPENING_ROUNDS = 2;

/** How fast one battle went and what it cost. */
export interface Tempo {
  /** The round of the first hand-to-hand attack; `null` when the armies never met. */
  readonly contactRound: number | null;
  /** Rounds from the first clash to the end, both counted; 0 when the armies never met. */
  readonly roundsOfFighting: number;
  /** Units destroyed on both sides. */
  readonly destroyed: number;
  /** Units of both sides that ran from the battlefield. */
  readonly fled: number;
  /**
   * Share of its army the loser had lost `OPENING_ROUNDS` rounds after the first clash; `null`
   * when nobody lost or the armies never met.
   */
  readonly loserOpeningLosses: number | null;
  /** Share of the winner's army still on the field at the end; `null` when nobody won. */
  readonly winnerLeft: number | null;
}

/** The mean of the battles of a series; a share is the mean of the battles that have one. */
export interface SeriesTempo {
  readonly contactRound: number;
  readonly roundsOfFighting: number;
  readonly destroyed: number;
  readonly fled: number;
  readonly loserOpeningLosses: number;
  readonly winnerLeft: number;
}

/** How a number of battles of one scenario between two AIs ended. */
export interface Series {
  readonly scenarioId: string;
  /** The level of the AI on each side. */
  readonly levels: Readonly<Record<PlayerSlot, Difficulty>>;
  readonly battles: number;
  readonly wins: Readonly<Record<PlayerSlot, number>>;
  /** Battles nobody won before the round limit, and those the AIs did not finish at all. */
  readonly draws: number;
  /** Battles won by taking the camp; the rest of the wins broke the enemy army. */
  readonly campsTaken: number;
  /** The round the shortest and the longest battle ended in, and the mean of all. */
  readonly rounds: { readonly min: number; readonly max: number; readonly mean: number };
  readonly tempo: SeriesTempo;
}

/** Reads the tempo of a battle from what happened in it. */
export function battleTempo({ state, events }: SimulatedBattle): Tempo {
  const losses: { readonly round: number; readonly owner: PlayerSlot }[] = [];
  let round = 1;
  let contactRound: number | null = null;
  let destroyed = 0;
  let fled = 0;
  for (const event of events) {
    if (event.type === 'TurnStarted') round = event.turn;
    if (event.type === 'AttackResolved' && event.kind === 'melee') contactRound ??= round;
    if (event.type === 'UnitDied' || event.type === 'UnitFled') {
      if (event.type === 'UnitDied') destroyed++;
      else fled++;
      losses.push({ round, owner: state.units[event.unitId]!.owner });
    }
  }

  const armySize = (owner: PlayerSlot) =>
    Object.values(state.units).filter((unit) => unit.owner === owner).length;
  const lostShare = (owner: PlayerSlot, untilRound: number) =>
    losses.filter((loss) => loss.owner === owner && loss.round <= untilRound).length /
    armySize(owner);
  const winner = state.winner?.player;

  return {
    contactRound,
    roundsOfFighting: contactRound === null ? 0 : state.turn - contactRound + 1,
    destroyed,
    fled,
    loserOpeningLosses:
      winner === undefined || contactRound === null
        ? null
        : lostShare(opponentOf(winner), contactRound + OPENING_ROUNDS),
    winnerLeft: winner === undefined ? null : 1 - lostShare(winner, state.turn),
  };
}

function mean(values: readonly (number | null)[]): number {
  const known = values.filter((value) => value !== null);
  return known.reduce((sum, value) => sum + value, 0) / Math.max(known.length, 1);
}

/**
 * Lets two AIs fight the scenario once from every seed and counts who won. The same seeds give
 * the same series, so two versions of a scenario or of an AI can be compared battle by battle.
 */
export function playSeries(
  scenario: ScenarioDef,
  levels: Readonly<Record<PlayerSlot, Difficulty>>,
  seeds: readonly number[]
): Series {
  const wins: Record<PlayerSlot, number> = { 0: 0, 1: 0 };
  let campsTaken = 0;
  const rounds: number[] = [];
  const tempos: Tempo[] = [];
  for (const seed of seeds) {
    const battle = simulateBattle(startScenario(scenario, seed), {
      0: createAi(levels[0], seed),
      1: createAi(levels[1], seed + SECOND_PLAYER_SEED),
    });
    const { winner } = battle.state;
    if (winner) wins[winner.player]++;
    if (winner?.reason === 'campCaptured') campsTaken++;
    rounds.push(battle.state.turn);
    tempos.push(battleTempo(battle));
  }
  return {
    scenarioId: scenario.id,
    levels,
    battles: seeds.length,
    wins,
    draws: seeds.length - wins[0] - wins[1],
    campsTaken,
    rounds: {
      min: Math.min(...rounds),
      max: Math.max(...rounds),
      mean: mean(rounds),
    },
    tempo: {
      contactRound: mean(tempos.map((tempo) => tempo.contactRound)),
      roundsOfFighting: mean(tempos.map((tempo) => tempo.roundsOfFighting)),
      destroyed: mean(tempos.map((tempo) => tempo.destroyed)),
      fled: mean(tempos.map((tempo) => tempo.fled)),
      loserOpeningLosses: mean(tempos.map((tempo) => tempo.loserOpeningLosses)),
      winnerLeft: mean(tempos.map((tempo) => tempo.winnerLeft)),
    },
  };
}
