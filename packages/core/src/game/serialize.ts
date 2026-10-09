import { RULES_VERSION } from '../version';
import type { Hex } from '../hex/hex';
import type { AbilityId } from '../units/unitType';
import type { BattleState, Phase, PlayerSlot, VictoryReason, Winner } from './battleState';
import { PHASES, PLAYER_SLOTS, VICTORY_REASONS } from './battleState';
import type { RngState } from './rng';
import type { MoraleState, Unit, UnitStatus } from './unit';
import { MORALE_STATES, UNIT_STATUSES } from './unit';

/** A saved battle: the state and the version of the rules it was played with. */
export interface SavedBattle {
  readonly rulesVersion: number;
  readonly state: BattleState;
}

const UINT32_MAX = 0xffff_ffff;

export function serializeBattle(state: BattleState): string {
  const saved: SavedBattle = { rulesVersion: RULES_VERSION, state };
  return JSON.stringify(saved);
}

/** Reads a saved battle back. Throws when the text is not a save of this version of the rules. */
export function deserializeBattle(json: string): BattleState {
  let saved: unknown;
  try {
    saved = JSON.parse(json);
  } catch {
    throw new Error('Saved battle is not valid JSON');
  }
  if (!isRecord(saved)) {
    throw new Error('Saved battle must be an object');
  }
  if (saved.rulesVersion !== RULES_VERSION) {
    throw new Error(
      `Saved battle has rules version ${String(saved.rulesVersion)}, expected ${RULES_VERSION}`
    );
  }
  return readState(saved.state);
}

function readState(state: unknown): BattleState {
  if (!isRecord(state)) {
    throw invalid('state', 'an object');
  }
  const { scenarioId, phase, turn, activePlayer } = state;
  if (typeof scenarioId !== 'string') {
    throw invalid('state.scenarioId', 'a string');
  }
  if (!(PHASES as readonly unknown[]).includes(phase)) {
    throw invalid('state.phase', `one of ${PHASES.join(', ')}`);
  }
  if (!Number.isInteger(turn) || (turn as number) < 1) {
    throw invalid('state.turn', 'a positive integer');
  }
  if (!(PLAYER_SLOTS as readonly unknown[]).includes(activePlayer)) {
    throw invalid('state.activePlayer', `one of ${PLAYER_SLOTS.join(', ')}`);
  }
  const winner = readWinner(state.winner);
  return {
    scenarioId,
    phase: phase as Phase,
    turn: turn as number,
    activePlayer: activePlayer as PlayerSlot,
    units: readUnits(state.units),
    ...(winner && { winner }),
    rng: readRng(state.rng),
  };
}

function readUnits(units: unknown): Record<string, Unit> {
  if (!isRecord(units)) {
    throw invalid('state.units', 'an object');
  }
  const read: Record<string, Unit> = {};
  for (const [id, unit] of Object.entries(units)) {
    read[id] = readUnit(unit, id);
  }
  return read;
}

function readUnit(unit: unknown, id: string): Unit {
  const field = `state.units.${id}`;
  if (!isRecord(unit)) {
    throw invalid(field, 'an object');
  }
  if (unit.id !== id) {
    throw invalid(`${field}.id`, 'the key the unit is stored under');
  }
  if (typeof unit.typeId !== 'string') {
    throw invalid(`${field}.typeId`, 'a string');
  }
  if (!isOneOf(PLAYER_SLOTS, unit.owner)) {
    throw invalid(`${field}.owner`, `one of ${PLAYER_SLOTS.join(', ')}`);
  }
  if (!isOneOf(UNIT_STATUSES, unit.status)) {
    throw invalid(`${field}.status`, `one of ${UNIT_STATUSES.join(', ')}`);
  }
  if (!isOneOf(MORALE_STATES, unit.moraleState)) {
    throw invalid(`${field}.moraleState`, `one of ${MORALE_STATES.join(', ')}`);
  }
  const pos = unit.pos === null ? null : readHex(unit.pos, `${field}.pos`);
  if ((pos === null) === (unit.status === 'active')) {
    throw invalid(`${field}.pos`, 'a hex for a unit on the battlefield and null for any other');
  }
  for (const stat of ['hp', 'morale', 'movementLeft'] as const) {
    if (!isAmount(unit[stat])) throw invalid(`${field}.${stat}`, 'a number that is not negative');
  }
  for (const flag of ['hasAttacked', 'hasRetreated'] as const) {
    if (typeof unit[flag] !== 'boolean') throw invalid(`${field}.${flag}`, 'true or false');
  }
  const { spentAbilities } = unit;
  if (!Array.isArray(spentAbilities) || spentAbilities.some((spent) => typeof spent !== 'string')) {
    throw invalid(`${field}.spentAbilities`, 'a list of ability ids');
  }
  return {
    id,
    typeId: unit.typeId,
    owner: unit.owner,
    pos,
    hp: unit.hp as number,
    morale: unit.morale as number,
    moraleState: unit.moraleState as MoraleState,
    movementLeft: unit.movementLeft as number,
    hasAttacked: unit.hasAttacked as boolean,
    status: unit.status as UnitStatus,
    hasRetreated: unit.hasRetreated as boolean,
    spentAbilities: [...(spentAbilities as AbilityId[])],
  };
}

function readHex(hex: unknown, field: string): Hex {
  if (!isRecord(hex) || !Number.isInteger(hex.q) || !Number.isInteger(hex.r)) {
    throw invalid(field, 'a hex with whole-number q and r');
  }
  return { q: hex.q as number, r: hex.r as number };
}

function readWinner(winner: unknown): Winner | undefined {
  if (winner === undefined) return undefined;
  if (
    !isRecord(winner) ||
    !isOneOf(PLAYER_SLOTS, winner.player) ||
    !isOneOf(VICTORY_REASONS, winner.reason)
  ) {
    throw invalid('state.winner', 'a player and the reason they won');
  }
  return { player: winner.player, reason: winner.reason as VictoryReason };
}

function readRng(rng: unknown): RngState {
  if (!isRecord(rng) || !isUint32(rng.seed) || !isUint32(rng.state)) {
    throw invalid('state.rng', 'a seed and a state, both unsigned 32-bit integers');
  }
  return { seed: rng.seed, state: rng.state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T>(allowed: readonly T[], value: unknown): value is T {
  return (allowed as readonly unknown[]).includes(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUint32(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= UINT32_MAX;
}

function invalid(field: string, expected: string): Error {
  return new Error(`Saved battle is damaged: ${field} must be ${expected}`);
}
