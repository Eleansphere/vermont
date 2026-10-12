import { describe, expect, it } from 'vitest';
import type {
  BattleDefs,
  BattleState,
  Command,
  Hex,
  PlayerSlot,
  Unit,
  UnitPlacement,
} from '@vermont/core';
import {
  RULES,
  SCENARIOS,
  createBattle,
  createDefs,
  createMap,
  createUnits,
  dispatch,
  fieldedUnits,
  hex,
  hexDistance,
  hexEquals,
  hexagonHexes,
  playerView,
  reserveUnits,
  startScenario,
} from '@vermont/core';
import type { Difficulty } from './ai';
import { createAi } from './ai';
import { decide } from './decide';

const SEED = 7;
const FIELD_RADIUS = 6;
const THINKING: readonly Difficulty[] = ['normal', 'hard'];

interface Battle {
  readonly state: BattleState;
  readonly defs: BattleDefs;
}

function place(id: string, typeId: string, owner: PlayerSlot, q: number, r: number): UnitPlacement {
  return { id, typeId, owner, pos: hex(q, r) };
}

/** A battle in progress on an open plain, with nothing hidden unless `fog` is set. */
function battleWith(
  placements: readonly UnitPlacement[],
  options: { camps?: BattleDefs['camps']; fog?: boolean } = {}
): Battle {
  const defs = createDefs(createMap('plain', hexagonHexes(FIELD_RADIUS)), {
    rules: { ...RULES, fog: { ...RULES.fog, enabled: options.fog ?? false } },
    camps: options.camps ?? {},
  });
  const state = createBattle({
    scenarioId: 'test',
    seed: SEED,
    phase: 'battle',
    units: createUnits(defs.unitTypes, defs.rules.morale, placements),
  });
  return { state, defs };
}

function withUnit(battle: Battle, unitId: string, changes: Partial<Unit>): Battle {
  const unit = { ...battle.state.units[unitId]!, ...changes };
  return {
    ...battle,
    state: { ...battle.state, units: { ...battle.state.units, [unitId]: unit } },
  };
}

function orderOf(battle: Battle, difficulty: Difficulty): Command {
  const view = playerView(battle.state, battle.defs, battle.state.activePlayer);
  return decide(view, battle.defs, createAi(difficulty, SEED)).command;
}

/** Everything the AI orders until it hands the move over; every command has to be accepted. */
function playTurn(
  battle: Battle,
  difficulty: Difficulty
): { state: BattleState; commands: Command[] } {
  const player = battle.state.activePlayer;
  let { state } = battle;
  let ai = createAi(difficulty, SEED);
  const commands: Command[] = [];
  while (state.phase !== 'ended' && state.activePlayer === player) {
    const decision = decide(playerView(state, battle.defs, player), battle.defs, ai);
    const result = dispatch(state, decision.command, battle.defs);
    if (!result.ok) throw new Error(`${decision.command.type}: ${result.rejection.message}`);
    ai = decision.ai;
    state = result.state;
    commands.push(decision.command);
  }
  return { state, commands };
}

function positionOf(state: BattleState, unitId: string): Hex {
  return state.units[unitId]!.pos!;
}

describe('decide', () => {
  it('refuses to command for a player who is not on the move', () => {
    const battle = battleWith([place('own', 'hastati', 0, 0, 0), place('foe', 'hastati', 1, 3, 0)]);
    const view = playerView(battle.state, battle.defs, 1);

    expect(() => decide(view, battle.defs, createAi('hard', SEED))).toThrow(/not on the move/);
  });

  it('decides the same way again from the same seed', () => {
    const battle = battleWith([place('own', 'hastati', 0, 0, 0), place('foe', 'hastati', 1, 4, 0)]);
    const view = playerView(battle.state, battle.defs, 0);

    const first = decide(view, battle.defs, createAi('easy', SEED));
    const second = decide(view, battle.defs, createAi('easy', SEED));

    expect(second).toEqual(first);
    expect(first.ai.rng).not.toEqual(createAi('easy', SEED).rng);
  });

  it.each(THINKING)('%s: marches into the enemy camp when a unit can reach it', (difficulty) => {
    const camp = hex(4, 0);
    const battle = battleWith(
      [place('rider', 'equites', 0, 0, 0), place('foe', 'hastati', 1, -4, 5)],
      { camps: { 1: camp } }
    );

    const turn = playTurn(battle, difficulty);

    expect(turn.state.winner).toEqual({ player: 0, reason: 'campCaptured' });
  });

  it.each(THINKING)('%s: strikes the enemy it can destroy', (difficulty) => {
    const battle = withUnit(
      battleWith([
        place('own', 'hastati', 0, 0, 0),
        place('fresh', 'hastati', 1, 1, 0),
        place('broken', 'hastati', 1, 0, 1),
      ]),
      'broken',
      { hp: 2 }
    );

    const turn = playTurn(battle, difficulty);

    expect(turn.commands).toContainEqual({ type: 'Attack', unitId: 'own', targetId: 'broken' });
    expect(turn.state.units.broken!.status).toBe('dead');
  });

  it.each(THINKING)('%s: closes in on the enemy and attacks it', (difficulty) => {
    const battle = battleWith([place('own', 'hastati', 0, 0, 0), place('foe', 'triarii', 1, 3, 0)]);

    const turn = playTurn(battle, difficulty);

    expect(turn.commands.map((command) => command.type)).toEqual(['MoveUnit', 'Attack', 'EndTurn']);
  });

  it.each(THINKING)('%s: keeps a unit on its camp', (difficulty) => {
    const camp = hex(-4, 0);
    const battle = battleWith(
      [
        place('guard', 'triarii', 0, -4, 0),
        place('line', 'hastati', 0, -2, 0),
        place('foe', 'hastati', 1, 3, 0),
      ],
      { camps: { 0: camp, 1: hex(5, 0) } }
    );

    const turn = playTurn(battle, difficulty);

    expect(positionOf(turn.state, 'guard')).toEqual(camp);
    expect(hexEquals(positionOf(turn.state, 'line'), hex(-2, 0))).toBe(false);
  });

  it.each(THINKING)('%s: shoots from a distance instead of closing in', (difficulty) => {
    const battle = battleWith([
      place('slingers', 'balearic-slingers', 0, 0, 0),
      place('foe', 'hastati', 1, 3, 0),
    ]);

    const turn = playTurn(battle, difficulty);

    expect(turn.commands).toContainEqual({ type: 'Attack', unitId: 'slingers', targetId: 'foe' });
    expect(hexDistance(positionOf(turn.state, 'slingers'), hex(3, 0))).toBeGreaterThan(1);
  });

  it('knows nothing of an enemy hidden in the fog', () => {
    const camps = { 1: hex(6, 0) };
    const seen = [place('own', 'hastati', 0, -5, 0), place('foe', 'hastati', 1, 5, 0)];
    const hidden = place('ambush', 'hastati', 1, 1, -5);
    const withAmbush = battleWith([...seen, hidden], { camps, fog: true });
    const withoutIt = battleWith(seen, { camps, fog: true });

    expect(orderOf(withAmbush, 'hard')).toEqual(orderOf(withoutIt, 'hard'));
  });

  describe('hard', () => {
    it('sends a fresh unit to take the place of a weakened one in the line', () => {
      const battle = withUnit(
        battleWith([
          place('fresh', 'principes', 0, -1, 0),
          place('tired', 'hastati', 0, 0, 0),
          place('foe', 'hastati', 1, 1, 0),
        ]),
        'tired',
        { hp: 2 }
      );

      const turn = playTurn(battle, 'hard');

      expect(turn.commands[0]).toEqual({
        type: 'UseAbility',
        unitId: 'fresh',
        abilityId: 'lineRelief',
        targetId: 'tired',
      });
      expect(positionOf(turn.state, 'fresh')).toEqual(hex(0, 0));
    });

    it('pulls a shaken unit away from the enemy', () => {
      const battle = withUnit(
        battleWith(
          [
            place('shaken', 'hastati', 0, 0, 0),
            place('first', 'hastati', 0, -1, 2),
            place('second', 'hastati', 0, 1, -2),
            place('guard', 'triarii', 0, -5, 0),
            place('foe', 'hastati', 1, 1, 0),
          ],
          { camps: { 0: hex(-5, 0) } }
        ),
        'shaken',
        { morale: 3, moraleState: 'shaken' }
      );

      const turn = playTurn(battle, 'hard');

      expect(hexDistance(positionOf(turn.state, 'shaken'), hex(1, 0))).toBeGreaterThan(1);
    });

    it('does not send a lone rider into the enemy line', () => {
      const battle = battleWith([
        place('rider', 'equites', 0, -4, 0),
        place('foot', 'hastati', 0, -5, 0),
        place('other', 'hastati', 0, -5, 1),
        place('spears', 'libyan-spearmen', 1, 2, 0),
        place('more', 'libyan-spearmen', 1, 2, 1),
        place('gauls', 'gallic-mercenaries', 1, 3, -1),
      ]);

      const turn = playTurn(battle, 'hard');

      const enemies = fieldedUnits(turn.state, 1);
      const rider = positionOf(turn.state, 'rider');
      expect(enemies.every((enemy) => hexDistance(enemy.pos, rider) > 1)).toBe(true);
    });
  });

  describe('deployment', () => {
    /** Player 0 deploys the whole army of the scenario. */
    function deployed(difficulty: Difficulty): BattleState {
      const start = startScenario(SCENARIOS.trebia!, SEED);
      let state = start.state;
      let ai = createAi(difficulty, SEED);
      while (state.activePlayer === 0 && state.phase === 'deployment') {
        const decision = decide(playerView(state, start.defs, 0), start.defs, ai);
        const result = dispatch(state, decision.command, start.defs);
        if (!result.ok) throw new Error(result.rejection.message);
        ai = decision.ai;
        state = result.state;
      }
      return state;
    }

    it.each(['easy', ...THINKING] as const)(
      '%s: puts the whole army on the field',
      (difficulty) => {
        const state = deployed(difficulty);

        expect(reserveUnits(state, 0)).toEqual([]);
        expect(state.activePlayer).toBe(1);
      }
    );

    it.each(THINKING)('%s: draws the army up as a battle line', (difficulty) => {
      const units = fieldedUnits(deployed(difficulty), 0);
      const frontRow = Math.max(...units.map((unit) => unit.pos.r));
      const front = units
        .filter((unit) => unit.pos.r === frontRow)
        .sort((a, b) => a.pos.q - b.pos.q);
      const shooters = units.filter((unit) => unit.typeId === 'velites');

      expect(front.at(0)!.typeId).toBe('equites');
      expect(front.at(-1)!.typeId).toBe('equites');
      expect(shooters.every((unit) => unit.pos.r === frontRow - 1)).toBe(true);
    });
  });
});
