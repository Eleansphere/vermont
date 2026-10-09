import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../data/scenarios';
import type { Hex, HexKey } from '../hex/hex';
import { hex, hexKey } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { rectangleHexes } from '../map/shapes';
import { startScenario } from '../scenario/startScenario';
import type { PlayerSlot } from './battleState';
import type { Command, GameEvent } from './command';
import { autoDeployment } from './deployment';
import { dispatchAll } from './dispatch';
import { eventsSeenBy, playerSight, playerView, seesUnit } from './fog';
import type { TestBattle } from './testSupport';
import {
  END_TURN,
  FOG_RULES,
  battleWith,
  place,
  play,
  rejectionOf,
  unitOf,
  withUnit,
} from './testSupport';
import type { UnitPlacement } from './unit';

/** A single row of plain hexes from (0,0) to (11,0). */
const ROW = createMap('row', rectangleHexes(12, 1));

/** Hexes of the row from `fromQ` to `toQ`. */
function row(fromQ: number, toQ: number): Hex[] {
  const step = toQ >= fromQ ? 1 : -1;
  return Array.from({ length: Math.abs(toQ - fromQ) + 1 }, (_, index) =>
    hex(fromQ + index * step, 0)
  );
}

function keys(hexes: readonly Hex[]): HexKey[] {
  return hexes.map(hexKey).sort();
}

function move(unitId: string, ...path: Hex[]): Command {
  return { type: 'MoveUnit', unitId, path };
}

/** A battle in the fog, on the row unless another map is given. */
function foggy(placements: readonly UnitPlacement[], map = ROW): TestBattle {
  return battleWith(placements, { map, rules: FOG_RULES });
}

function sightOf(battle: TestBattle, player: PlayerSlot): HexKey[] {
  return [...playerSight(battle.state, battle.defs, player)].sort();
}

/** The same battle with another sight for one unit type. */
function withSight(battle: TestBattle, typeId: string, sight: number): TestBattle {
  const type = battle.defs.unitTypes[typeId]!;
  return {
    ...battle,
    defs: { ...battle.defs, unitTypes: { ...battle.defs.unitTypes, [typeId]: { ...type, sight } } },
  };
}

/** What `player` witnessed of the commands, carried out one after another. */
function witnessed(battle: TestBattle, player: PlayerSlot, ...commands: Command[]): GameEvent[] {
  let current = battle;
  const seen: GameEvent[] = [];
  for (const command of commands) {
    const after = play(current, command);
    seen.push(...eventsSeenBy(after.events, current.state, after.state, battle.defs, player));
    current = after;
  }
  return seen;
}

const ROMAN = place('hastati', 'hastati', 0, 0, 0);

describe('playerSight', () => {
  it('reaches as far as the sight of the units', () => {
    const battle = foggy([ROMAN, place('equites', 'equites', 0, 7, 0)]);

    expect(sightOf(battle, 0)).toEqual(keys([...row(0, 3), ...row(4, 11)]));
  });

  it('sees nothing for a side with no unit and no camp', () => {
    expect(sightOf(foggy([ROMAN]), 1)).toEqual([]);
  });

  it('reaches one hex further from a hill, and over a forest below it', () => {
    const map = paintTerrain(paintTerrain(ROW, 'hill', [hex(5, 0)]), 'forest', [hex(3, 0)]);

    expect(sightOf(foggy([place('hastati', 'hastati', 0, 5, 0)], map), 0)).toEqual(keys(row(1, 9)));
  });

  it('stops behind a forest for a unit on low ground', () => {
    const map = paintTerrain(ROW, 'forest', [hex(4, 0)]);

    expect(sightOf(foggy([place('hastati', 'hastati', 0, 6, 0)], map), 0)).toEqual(keys(row(4, 9)));
  });

  it('does not reach past a unit standing in the way', () => {
    const battle = foggy([ROMAN, place('gauls', 'gallic-mercenaries', 1, 2, 0)]);

    expect(sightOf(battle, 0)).toEqual(keys(row(0, 2)));
  });

  it('includes what the camp sees', () => {
    const battle = battleWith([ROMAN], { map: ROW, rules: FOG_RULES, camps: { 0: hex(11, 0) } });

    expect(sightOf(battle, 0)).toEqual(keys([...row(0, 3), ...row(8, 11)]));
  });

  it('is the whole map without the fog and once the battle is over', () => {
    const clear = battleWith([ROMAN], { map: ROW });
    const fought = foggy([ROMAN]);
    const over: TestBattle = { ...fought, state: { ...fought.state, phase: 'ended' } };

    expect(sightOf(clear, 0)).toEqual(keys(row(0, 11)));
    expect(sightOf(over, 0)).toEqual(keys(row(0, 11)));
  });
});

describe('playerView', () => {
  const battle = withUnit(
    foggy([
      ROMAN,
      place('near', 'gallic-mercenaries', 1, 3, 0),
      place('far', 'gallic-mercenaries', 1, 8, 0),
      place('fallen', 'gallic-mercenaries', 1, 9, 0),
    ]),
    'fallen',
    { status: 'dead', pos: null }
  );
  const { state, defs } = battle;

  it('leaves out the enemy units the player cannot see', () => {
    const view = playerView(state, defs, 0);

    expect(Object.keys(view.state.units).sort()).toEqual(['fallen', 'hastati', 'near']);
    expect(view.player).toBe(0);
    expect(view.visible).toEqual(playerSight(state, defs, 0));
  });

  it('shows each side its own units whatever the other side sees', () => {
    const view = playerView(state, defs, 1);

    expect(Object.keys(view.state.units).sort()).toEqual(['fallen', 'far', 'hastati', 'near']);
    expect(seesUnit(state, defs, 0, unitOf(battle, 'far'))).toBe(false);
    expect(seesUnit(state, defs, 1, unitOf(battle, 'far'))).toBe(true);
  });

  it('hides the dice and leaves the real state alone', () => {
    const rng = { ...state.rng };

    expect(playerView(state, defs, 0).state.rng).not.toEqual(rng);
    expect(state.rng).toEqual(rng);
  });

  it('hides the whole enemy army while the armies deploy', () => {
    const view = playerView({ ...state, phase: 'deployment' }, defs, 0);

    expect(Object.keys(view.state.units).sort()).toEqual(['fallen', 'hastati']);
  });

  it('is the state itself without the fog and once the battle is over', () => {
    const clear = battleWith([place('far', 'gallic-mercenaries', 1, 8, 0)], { map: ROW });
    const over = { ...state, phase: 'ended' as const };

    expect(playerView(clear.state, clear.defs, 0).state).toBe(clear.state);
    expect(playerView(over, defs, 0).state).toBe(over);
  });

  it('starts the Trebia with neither army in sight of the other', () => {
    const started = startScenario(SCENARIOS.trebia!, 1);
    let current = started.state;
    while (current.phase === 'deployment') {
      const result = dispatchAll(
        current,
        [...autoDeployment(current, started.defs), { type: 'EndDeployment' }],
        started.defs
      );
      if (!result.ok) throw new Error(result.rejection.message);
      current = result.state;
    }

    for (const player of [0, 1] as const) {
      const units = Object.values(playerView(current, started.defs, player).state.units);
      expect(units).toHaveLength(12);
      expect(units.every((unit) => unit.owner === player)).toBe(true);
    }
  });
});

describe('MoveUnit in the fog', () => {
  const GAULS = place('gauls', 'gallic-mercenaries', 1, 6, 0);
  const ambush = foggy([place('equites', 'equites', 0, 0, 0), GAULS]);

  it('stops a unit that walks into the zone of control of a hidden enemy', () => {
    const stopped = play(ambush, move('equites', ...row(0, 7)));

    expect(unitOf(stopped, 'equites')).toMatchObject({ pos: hex(5, 0), movementLeft: 0 });
    expect(stopped.events).toEqual([
      { type: 'UnitMoved', unitId: 'equites', path: row(0, 5), cost: 5 },
      { type: 'UnitAmbushed', unitId: 'equites', hex: hex(5, 0) },
    ]);
  });

  it('stops a unit in front of a hidden enemy that stands in its way', () => {
    const routing = withUnit(ambush, 'gauls', { morale: 0, moraleState: 'routing' });

    const stopped = play(routing, move('equites', ...row(0, 7)));

    expect(unitOf(stopped, 'equites')).toMatchObject({ pos: hex(5, 0), movementLeft: 0 });
    expect(stopped.events.at(-1)).toEqual({
      type: 'UnitAmbushed',
      unitId: 'equites',
      hex: hex(5, 0),
    });
  });

  it('does not call it an ambush when the unit stops where it was sent', () => {
    const after = play(ambush, move('equites', ...row(0, 5)));

    expect(unitOf(after, 'equites')).toMatchObject({ pos: hex(5, 0), movementLeft: 0 });
    expect(after.events.map((event) => event.type)).toEqual(['UnitMoved']);
  });

  it('refuses the same route once the enemy is known', () => {
    const clear = battleWith([place('equites', 'equites', 0, 0, 0), GAULS], { map: ROW });
    const inSight = foggy([place('equites', 'equites', 0, 2, 0), GAULS]);

    expect(rejectionOf(ambush, move('equites', ...row(0, 7)))).toBeNull();
    expect(rejectionOf(clear, move('equites', ...row(0, 7)))).toBe('zoneOfControl');
    expect(rejectionOf(inSight, move('equites', ...row(2, 7)))).toBe('zoneOfControl');
  });

  it('walks a route clear of hidden enemies to its end', () => {
    const after = play(ambush, move('equites', ...row(0, 4)));

    expect(unitOf(after, 'equites')).toMatchObject({ pos: hex(4, 0), movementLeft: 3 });
    expect(after.events).toEqual([
      { type: 'UnitMoved', unitId: 'equites', path: row(0, 4), cost: 4 },
    ]);
  });
});

describe('Attack in the fog', () => {
  it('refuses a target the player cannot see as if it were not there', () => {
    const battle = foggy([
      place('velites', 'velites', 0, 0, 0),
      place('gauls', 'gallic-mercenaries', 1, 2, 0),
    ]);
    const attack: Command = { type: 'Attack', unitId: 'velites', targetId: 'gauls' };

    expect(rejectionOf(battle, attack)).toBeNull();
    expect(rejectionOf(withSight(battle, 'velites', 1), attack)).toBe('invalidTarget');
  });
});

describe('eventsSeenBy', () => {
  const battle = foggy([ROMAN, place('gauls', 'gallic-mercenaries', 1, 9, 0)]);
  const enemyTurn = play(battle, END_TURN);

  it('shows a player everything their own units do', () => {
    expect(witnessed(battle, 0, move('hastati', ...row(0, 2)))).toEqual([
      { type: 'UnitMoved', unitId: 'hastati', path: row(0, 2), cost: 2 },
    ]);
  });

  it('hides an enemy march that stays in the fog', () => {
    expect(witnessed(enemyTurn, 0, move('gauls', ...row(9, 6)))).toEqual([]);
  });

  it('cuts an enemy march to the part the player saw', () => {
    const closer = play(foggy([ROMAN, place('gauls', 'gallic-mercenaries', 1, 5, 0)]), END_TURN);

    expect(witnessed(closer, 0, move('gauls', ...row(5, 2)))).toEqual([
      { type: 'UnitMoved', unitId: 'gauls', path: row(3, 2), cost: 3 },
    ]);
  });

  it('shows the turn changing hands to both players', () => {
    for (const player of [0, 1] as const) {
      expect(witnessed(battle, player, END_TURN).map((event) => event.type)).toEqual([
        'TurnEnded',
        'TurnStarted',
      ]);
    }
  });

  it('shows a hit from an enemy the player cannot see', () => {
    const shot = withSight(
      foggy([place('velites', 'velites', 0, 0, 0), place('hastati', 'hastati', 1, 2, 0)]),
      'hastati',
      1
    );

    const seen = witnessed(shot, 1, { type: 'Attack', unitId: 'velites', targetId: 'hastati' });

    expect(seesUnit(shot.state, shot.defs, 1, unitOf(shot, 'velites'))).toBe(false);
    expect(seen.map((event) => event.type)).toEqual(
      expect.arrayContaining(['AttackResolved', 'UnitDamaged'])
    );
  });

  it('hides what the enemy deploys', () => {
    const { state, defs } = startScenario(SCENARIOS.trebia!, 1);
    const result = dispatchAll(state, autoDeployment(state, defs), defs);
    if (!result.ok) throw new Error(result.rejection.message);

    expect(eventsSeenBy(result.events, state, result.state, defs, 0)).toHaveLength(12);
    expect(eventsSeenBy(result.events, state, result.state, defs, 1)).toEqual([]);
  });

  it('shows everything without the fog', () => {
    const clear = play(
      battleWith([ROMAN, place('gauls', 'gallic-mercenaries', 1, 9, 0)], { map: ROW }),
      END_TURN
    );

    expect(witnessed(clear, 0, move('gauls', ...row(9, 6)))).toEqual([
      { type: 'UnitMoved', unitId: 'gauls', path: row(9, 6), cost: 3 },
    ]);
  });
});
