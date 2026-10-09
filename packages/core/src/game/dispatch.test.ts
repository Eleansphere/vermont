import { describe, expect, it } from 'vitest';
import { createMap } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import { createBattle, opponentOf } from './battleState';
import type { Command } from './command';
import { COMMAND_HANDLERS, dispatch, dispatchAll } from './dispatch';
import { createDefs } from './rules';

const END_TURN: Command = { type: 'EndTurn' };
const DEFS = createDefs(createMap('field', hexagonHexes(2)));

function battle() {
  return createBattle({ scenarioId: 'test', seed: 1, phase: 'battle' });
}

describe('createBattle', () => {
  it('starts in deployment, in the first turn, with player 0 to move', () => {
    expect(createBattle({ scenarioId: 'cannae', seed: 7 })).toEqual({
      scenarioId: 'cannae',
      phase: 'deployment',
      turn: 1,
      activePlayer: 0,
      units: {},
      rng: { seed: 7, state: 7 },
    });
  });

  it('can start straight in the battle phase', () => {
    expect(battle().phase).toBe('battle');
  });

  it('knows the opponent of each player', () => {
    expect(opponentOf(0)).toBe(1);
    expect(opponentOf(1)).toBe(0);
  });
});

describe('dispatch', () => {
  it('hands the move to the other player within the same turn', () => {
    const result = dispatch(battle(), END_TURN, DEFS);

    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({ activePlayer: 1, turn: 1 });
  });

  it('starts a new turn when the move returns to player 0', () => {
    const afterFirst = dispatch(battle(), END_TURN, DEFS).state;
    const result = dispatch(afterFirst, END_TURN, DEFS);

    expect(result.state).toMatchObject({ activePlayer: 0, turn: 2 });
  });

  it('reports the turn that ended and the one that started', () => {
    const afterFirst = dispatch(battle(), END_TURN, DEFS);
    const afterSecond = dispatch(afterFirst.state, END_TURN, DEFS);

    expect(afterFirst.ok && afterFirst.events).toEqual([
      { type: 'TurnEnded', player: 0, turn: 1 },
      { type: 'TurnStarted', player: 1, turn: 1 },
    ]);
    expect(afterSecond.ok && afterSecond.events).toEqual([
      { type: 'TurnEnded', player: 1, turn: 1 },
      { type: 'TurnStarted', player: 0, turn: 2 },
    ]);
  });

  it('returns a new state and leaves the old one untouched', () => {
    const before = Object.freeze({ ...battle(), rng: Object.freeze({ seed: 1, state: 1 }) });
    const result = dispatch(before, END_TURN, DEFS);

    expect(result.state).not.toBe(before);
    expect(before).toMatchObject({ activePlayer: 0, turn: 1 });
  });

  it('leaves the random generator alone when a command needs no randomness', () => {
    const before = battle();

    expect(dispatch(before, END_TURN, DEFS).state.rng).toBe(before.rng);
  });

  it('rejects a command in the wrong phase and returns the same state', () => {
    const deploying = createBattle({ scenarioId: 'test', seed: 1 });
    const result = dispatch(deploying, END_TURN, DEFS);

    expect(result).toEqual({
      ok: false,
      state: deploying,
      rejection: {
        code: 'wrongPhase',
        message: 'EndTurn is not possible in the deployment phase',
      },
    });
    expect(result.state).toBe(deploying);
  });

  it('rejects every command once the battle is over', () => {
    const ended = createBattle({ scenarioId: 'test', seed: 1, phase: 'ended' });
    const result = dispatch(ended, END_TURN, DEFS);

    expect(!result.ok && result.rejection).toEqual({
      code: 'battleEnded',
      message: 'EndTurn is not possible, the battle is over',
    });
  });

  it('rejects a command it does not know', () => {
    const unknown = [{ type: 'Surrender' }, { type: 'toString' }, {}, null] as unknown as Command[];

    for (const command of unknown) {
      const result = dispatch(battle(), command, DEFS);
      expect(!result.ok && result.rejection.code).toBe('unknownCommand');
    }
    expect(dispatch(battle(), unknown[0]!, DEFS)).toMatchObject({
      rejection: { message: 'Unknown command: "Surrender"' },
    });
  });

  it('has a handler for every command type', () => {
    expect(Object.keys(COMMAND_HANDLERS)).toEqual([
      'DeployUnit',
      'EndDeployment',
      'EndTurn',
      'MoveUnit',
      'Attack',
      'UseAbility',
    ]);
  });
});

describe('dispatchAll', () => {
  it('carries out the commands in order and collects their events', () => {
    const result = dispatchAll(battle(), [END_TURN, END_TURN, END_TURN], DEFS);

    expect(result.ok).toBe(true);
    expect(result.state).toMatchObject({ activePlayer: 1, turn: 2 });
    expect(result.events.map((event) => event.type)).toEqual([
      'TurnEnded',
      'TurnStarted',
      'TurnEnded',
      'TurnStarted',
      'TurnEnded',
      'TurnStarted',
    ]);
  });

  it('returns the starting state for an empty list', () => {
    const start = battle();

    expect(dispatchAll(start, [], DEFS)).toEqual({ ok: true, state: start, events: [] });
  });

  it('stops at the first rejected command and keeps what happened before it', () => {
    const surrender = { type: 'Surrender' } as unknown as Command;
    const result = dispatchAll(battle(), [END_TURN, surrender, END_TURN], DEFS);

    expect(result).toMatchObject({
      ok: false,
      commandIndex: 1,
      state: { activePlayer: 1, turn: 1 },
      rejection: { code: 'unknownCommand' },
    });
    expect(result.events).toHaveLength(2);
  });
});
