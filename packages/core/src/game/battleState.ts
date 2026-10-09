import type { RngState } from './rng';
import { createRng } from './rng';
import type { Unit } from './unit';

/** The two sides of a battle. */
export type PlayerSlot = 0 | 1;

export const PLAYER_SLOTS: readonly PlayerSlot[] = [0, 1];

export type Phase = 'deployment' | 'battle' | 'ended';

export const PHASES: readonly Phase[] = ['deployment', 'battle', 'ended'];

/**
 * Everything that changes during a battle. Plain data without methods or cycles, so saving is
 * `JSON.stringify`. It is never mutated: every command produces a new state.
 */
export interface BattleState {
  readonly scenarioId: string;
  readonly phase: Phase;
  /** Round number, starting at 1. Both players move once in every round. */
  readonly turn: number;
  readonly activePlayer: PlayerSlot;
  /** Every unit that started the battle, by id; destroyed and fled ones stay in the record. */
  readonly units: Readonly<Record<string, Unit>>;
  /** Set once the battle is over. */
  readonly winner?: Winner;
  readonly rng: RngState;
}

export type VictoryReason = 'campCaptured' | 'armyBroken';

export const VICTORY_REASONS: readonly VictoryReason[] = ['campCaptured', 'armyBroken'];

export interface Winner {
  readonly player: PlayerSlot;
  readonly reason: VictoryReason;
}

export interface BattleOptions {
  readonly scenarioId: string;
  readonly seed: number;
  /** Phase the battle starts in; a battle normally starts by deploying the armies. */
  readonly phase?: Phase;
  /** Units already standing on the map; see `createUnits`. */
  readonly units?: readonly Unit[];
}

const FIRST_TURN = 1;
const FIRST_PLAYER: PlayerSlot = 0;

export function createBattle(options: BattleOptions): BattleState {
  return {
    scenarioId: options.scenarioId,
    phase: options.phase ?? 'deployment',
    turn: FIRST_TURN,
    activePlayer: FIRST_PLAYER,
    units: unitsById(options.units ?? []),
    rng: createRng(options.seed),
  };
}

function unitsById(units: readonly Unit[]): Record<string, Unit> {
  const byId: Record<string, Unit> = {};
  for (const unit of units) {
    if (Object.hasOwn(byId, unit.id)) throw new Error(`Duplicate unit id: "${unit.id}"`);
    byId[unit.id] = unit;
  }
  return byId;
}

export function opponentOf(player: PlayerSlot): PlayerSlot {
  return player === 0 ? 1 : 0;
}
