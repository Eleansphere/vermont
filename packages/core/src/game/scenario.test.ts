import { describe, expect, it } from 'vitest';
import { createMap } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import type { BattleState } from './battleState';
import { createBattle } from './battleState';
import type { Command } from './command';
import { dispatch, dispatchAll } from './dispatch';
import { createDefs } from './rules';
import { nextRandom } from './rng';
import { deserializeBattle, serializeBattle } from './serialize';

const END_TURN: Command = { type: 'EndTurn' };
const DEFS = createDefs(createMap('field', hexagonHexes(2)));
const ROUNDS = 3;
const TURNS_PER_ROUND = 2;

function start(): BattleState {
  return createBattle({ scenarioId: 'empty-field', seed: 2026, phase: 'battle' });
}

describe('scenario: empty rounds of two players', () => {
  it('plays three rounds with the players taking turns', () => {
    let state = start();
    const whoMoved: string[] = [];

    for (let move = 0; move < ROUNDS * TURNS_PER_ROUND; move++) {
      whoMoved.push(`turn ${state.turn}, player ${state.activePlayer}`);
      const result = dispatch(state, END_TURN, DEFS);
      expect(result.ok).toBe(true);
      state = result.state;
    }

    expect(whoMoved).toEqual([
      'turn 1, player 0',
      'turn 1, player 1',
      'turn 2, player 0',
      'turn 2, player 1',
      'turn 3, player 0',
      'turn 3, player 1',
    ]);
    expect(state).toEqual({ ...start(), turn: 4, activePlayer: 0 });
  });

  it('survives a save and load in the middle of the game without any change', () => {
    const commands: Command[] = Array.from({ length: ROUNDS * TURNS_PER_ROUND }, () => END_TURN);
    const uninterrupted = dispatchAll(start(), commands, DEFS);

    const firstHalf = dispatchAll(start(), commands.slice(0, 3), DEFS);
    const loaded = deserializeBattle(serializeBattle(firstHalf.state));
    const resumed = dispatchAll(loaded, commands.slice(3), DEFS);

    expect(loaded).toEqual(firstHalf.state);
    expect(resumed.state).toEqual(uninterrupted.state);
    expect(serializeBattle(resumed.state)).toBe(serializeBattle(uninterrupted.state));
  });

  it('gives the same result every time for the same start and commands', () => {
    const commands: Command[] = [END_TURN, END_TURN, END_TURN];

    expect(dispatchAll(start(), commands, DEFS)).toEqual(dispatchAll(start(), commands, DEFS));
  });

  it('keeps the random sequence going across a save and load', () => {
    const first = nextRandom(start().rng);
    const saved = serializeBattle({ ...start(), rng: first.rng });

    const expected = nextRandom(first.rng);
    expect(nextRandom(deserializeBattle(saved).rng)).toEqual(expected);
    expect(expected.value).not.toBe(first.value);
  });
});
