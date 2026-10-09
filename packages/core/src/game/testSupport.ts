import { RULES } from '../data/rules';
import { hex } from '../hex/hex';
import type { BattleMapDef } from '../map/battleMap';
import { createMap } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import type { BattleState, PlayerSlot } from './battleState';
import { createBattle } from './battleState';
import type { Command, GameEvent } from './command';
import { dispatch } from './dispatch';
import type { BattleDefs, BattleRules } from './rules';
import { createDefs } from './rules';
import type { Unit, UnitPlacement } from './unit';
import { createUnits, withUnits } from './unit';

/** The standard rules without the random spread, so tests can expect exact damage. */
export const EXACT_RULES: BattleRules = {
  ...RULES,
  combat: { ...RULES.combat, damageSpread: 0 },
};

const OPEN_FIELD_RADIUS = 5;

export interface TestBattle {
  readonly state: BattleState;
  readonly defs: BattleDefs;
}

export interface TestBattleOptions {
  readonly map?: BattleMapDef;
  readonly rules?: BattleRules;
  readonly camps?: BattleDefs['camps'];
  readonly seed?: number;
}

/** A unit for `battleWith`, named by its id so that tests read as sentences. */
export function place(
  id: string,
  typeId: string,
  owner: PlayerSlot,
  q: number,
  r: number
): UnitPlacement {
  return { id, typeId, owner, pos: hex(q, r) };
}

/** A battle in progress on an open plain, with exact damage unless other rules are given. */
export function battleWith(
  placements: readonly UnitPlacement[],
  options: TestBattleOptions = {}
): TestBattle {
  const defs = createDefs(options.map ?? createMap('plain', hexagonHexes(OPEN_FIELD_RADIUS)), {
    rules: options.rules ?? EXACT_RULES,
    camps: options.camps ?? {},
  });
  const state = createBattle({
    scenarioId: 'test',
    seed: options.seed ?? 1,
    phase: 'battle',
    units: createUnits(defs.unitTypes, defs.rules.morale, placements),
  });
  return { state, defs };
}

/** A battle after some commands, with everything that happened while they were carried out. */
export interface PlayedCommands extends TestBattle {
  readonly events: readonly GameEvent[];
}

/** Carries out the commands and fails the test when one of them is rejected. */
export function play(battle: TestBattle, ...commands: readonly Command[]): PlayedCommands {
  let state = battle.state;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const result = dispatch(state, command, battle.defs);
    if (!result.ok) {
      throw new Error(`${command.type} was rejected: ${result.rejection.message}`);
    }
    state = result.state;
    events.push(...result.events);
  }
  return { state, defs: battle.defs, events };
}

/** The code a command is rejected with, or `null` when it is accepted. */
export function rejectionOf(battle: TestBattle, command: Command): string | null {
  const result = dispatch(battle.state, command, battle.defs);
  return result.ok ? null : result.rejection.code;
}

/** The same battle with some fields of one unit overwritten. */
export function withUnit(battle: TestBattle, unitId: string, changes: Partial<Unit>): TestBattle {
  const unit = { ...unitOf(battle, unitId), ...changes };
  return { ...battle, state: withUnits(battle.state, [unit]) };
}

export function unitOf(battle: TestBattle, unitId: string): Unit {
  const unit = battle.state.units[unitId];
  if (!unit) throw new Error(`No unit "${unitId}" in the test battle`);
  return unit;
}

export const END_TURN: Command = { type: 'EndTurn' };

/** Both players end their turn, so the same player is on the move again. */
export function nextRound(battle: TestBattle): PlayedCommands {
  return play(battle, END_TURN, END_TURN);
}
