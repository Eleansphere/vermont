import { describe, expect, it } from 'vitest';
import type { Hex } from '../hex/hex';
import { hex } from '../hex/hex';
import { createMap, paintTerrain } from '../map/battleMap';
import { hexagonHexes } from '../map/shapes';
import { pathFromReach } from '../movement/movement';
import type { Command } from './command';
import { dispatch } from './dispatch';
import {
  END_TURN,
  battleWith,
  nextRound,
  place,
  play,
  rejectionOf,
  unitOf,
  withUnit,
} from './testSupport';
import type { FieldedUnit } from './unit';
import { unitReach } from './unitMovement';

function move(unitId: string, ...path: Hex[]): Command {
  return { type: 'MoveUnit', unitId, path };
}

/** Hexes of the row r = 0 from `fromQ` to `toQ`. */
function row(fromQ: number, toQ: number): Hex[] {
  const step = toQ >= fromQ ? 1 : -1;
  return Array.from({ length: Math.abs(toQ - fromQ) + 1 }, (_, index) =>
    hex(fromQ + index * step, 0)
  );
}

const OPEN = createMap('open', hexagonHexes(5));

describe('MoveUnit', () => {
  it('moves the unit along the path and spends its movement points', () => {
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)]);

    const after = play(battle, move('hastati', ...row(0, 3)));

    expect(unitOf(after, 'hastati')).toMatchObject({ pos: hex(3, 0), movementLeft: 1 });
    expect(after.events).toEqual([
      { type: 'UnitMoved', unitId: 'hastati', path: row(0, 3), cost: 3 },
    ]);
  });

  it('lets a unit move several times until its movement points run out', () => {
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)]);

    const after = play(battle, move('hastati', ...row(0, 2)), move('hastati', ...row(2, 4)));

    expect(unitOf(after, 'hastati')).toMatchObject({ pos: hex(4, 0), movementLeft: 0 });
    expect(rejectionOf(after, move('hastati', ...row(4, 5)))).toBe('notEnoughMovement');
  });

  it('gives the movement points back at the start of the next own turn', () => {
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)]);

    const after = nextRound(play(battle, move('hastati', ...row(0, 4))));

    expect(unitOf(after, 'hastati').movementLeft).toBe(4);
  });

  it('charges the terrain cost of every hex entered', () => {
    const map = paintTerrain(paintTerrain(OPEN, 'forest', [hex(1, 0)]), 'road', row(2, 4));
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)], { map });

    const after = play(battle, move('hastati', ...row(0, 4)));

    expect(after.events).toMatchObject([{ cost: 3.5 }]);
    expect(unitOf(after, 'hastati').movementLeft).toBe(0.5);
  });

  it('rejects a path longer than the movement points and leaves the state alone', () => {
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)]);

    const result = dispatch(battle.state, move('hastati', ...row(0, 5)), battle.defs);

    expect(result).toMatchObject({ ok: false, rejection: { code: 'notEnoughMovement' } });
    expect(result.state).toBe(battle.state);
  });

  it('rejects a path that is not a walk from the unit over neighbouring hexes', () => {
    const battle = battleWith([place('hastati', 'hastati', 0, 0, 0)]);
    const malformed = { type: 'MoveUnit', unitId: 'hastati', path: [hex(0, 0), null] };

    expect(rejectionOf(battle, move('hastati', hex(1, 0), hex(2, 0)))).toBe('invalidPath');
    expect(rejectionOf(battle, move('hastati', hex(0, 0)))).toBe('invalidPath');
    expect(rejectionOf(battle, move('hastati'))).toBe('invalidPath');
    expect(rejectionOf(battle, move('hastati', hex(0, 0), hex(2, 0)))).toBe('invalidPath');
    expect(rejectionOf(battle, malformed as unknown as Command)).toBe('invalidPath');
    expect(rejectionOf(battle, { type: 'MoveUnit', unitId: 'hastati' } as Command)).toBe(
      'invalidPath'
    );
  });

  it('rejects a path that leaves the map', () => {
    const battle = battleWith([place('equites', 'equites', 0, 4, 0)]);

    expect(rejectionOf(battle, move('equites', ...row(4, 6)))).toBe('invalidPath');
  });

  it('rejects terrain the unit cannot enter', () => {
    const map = paintTerrain(paintTerrain(OPEN, 'river', [hex(1, 0)]), 'mountain', [hex(0, 1)]);
    const battle = battleWith(
      [place('hastati', 'hastati', 0, 0, 0), place('equites', 'equites', 0, -1, 1)],
      { map }
    );

    expect(rejectionOf(battle, move('hastati', ...row(0, 1)))).toBe('impassable');
    expect(rejectionOf(battle, move('equites', hex(-1, 1), hex(0, 1)))).toBe('impassable');
    expect(rejectionOf(battle, move('hastati', hex(0, 0), hex(0, 1)))).toBeNull();
  });

  it('passes through units of its own side but does not stop on them', () => {
    const battle = battleWith([
      place('hastati', 'hastati', 0, 0, 0),
      place('principes', 'principes', 0, 1, 0),
    ]);

    expect(rejectionOf(battle, move('hastati', ...row(0, 1)))).toBe('hexOccupied');
    expect(unitOf(play(battle, move('hastati', ...row(0, 2))), 'hastati').pos).toEqual(hex(2, 0));
  });

  it('does not enter a hex held by the enemy', () => {
    const battle = battleWith([
      place('hastati', 'hastati', 0, 0, 0),
      place('gauls', 'gallic-mercenaries', 1, 1, 0),
    ]);

    expect(rejectionOf(battle, move('hastati', ...row(0, 1)))).toBe('hexOccupied');
  });

  it('only takes orders for units the active player has on the field', () => {
    const battle = withUnit(
      battleWith([
        place('hastati', 'hastati', 0, 0, 0),
        place('fallen', 'hastati', 0, 0, 1),
        place('gauls', 'gallic-mercenaries', 1, 4, 0),
      ]),
      'fallen',
      { status: 'dead', pos: null }
    );

    expect(rejectionOf(battle, move('gauls', ...row(4, 3)))).toBe('notYourUnit');
    expect(rejectionOf(battle, move('nobody', ...row(0, 1)))).toBe('unknownUnit');
    expect(rejectionOf(battle, move('toString', ...row(0, 1)))).toBe('unknownUnit');
    expect(rejectionOf(battle, move('fallen', hex(0, 1), hex(0, 2)))).toBe('unitNotOnField');
    expect(rejectionOf(play(battle, END_TURN), move('gauls', ...row(4, 3)))).toBeNull();
  });
});

describe('zones of control', () => {
  const facing = () =>
    battleWith([
      place('equites', 'equites', 0, -3, 0),
      place('gauls', 'gallic-mercenaries', 1, 1, 0),
    ]);

  it('stops a unit that steps next to an enemy', () => {
    const after = play(facing(), move('equites', ...row(-3, 0)));

    expect(unitOf(after, 'equites')).toMatchObject({ pos: hex(0, 0), movementLeft: 0 });
  });

  it('rejects a path that carries on past the hex next to an enemy', () => {
    const around = [...row(-3, 0), hex(0, 1)];

    expect(rejectionOf(facing(), move('equites', ...around))).toBe('zoneOfControl');
  });

  it('lets a unit that starts its turn next to an enemy walk away', () => {
    const engaged = nextRound(play(facing(), move('equites', ...row(-3, 0))));

    const after = play(engaged, move('equites', ...row(0, -3)));

    expect(unitOf(after, 'equites')).toMatchObject({ pos: hex(-3, 0), movementLeft: 4 });
  });

  it('is not held by an enemy that is running away', () => {
    const routed = withUnit(facing(), 'gauls', { morale: 1, moraleState: 'routing' });

    const after = play(routed, move('equites', ...row(-3, 0), hex(0, 1)));

    expect(unitOf(after, 'equites')).toMatchObject({ pos: hex(0, 1), movementLeft: 3 });
  });
});

describe('unitReach', () => {
  it('offers exactly the moves that MoveUnit accepts', () => {
    const map = paintTerrain(
      paintTerrain(paintTerrain(OPEN, 'forest', [hex(1, -1), hex(2, -1)]), 'river', [hex(-1, 0)]),
      'road',
      [hex(0, 1), hex(0, 2), hex(0, 3)]
    );
    const battle = battleWith(
      [
        place('hastati', 'hastati', 0, 0, 0),
        place('principes', 'principes', 0, 1, 0),
        place('gauls', 'gallic-mercenaries', 1, 3, 0),
        place('numidians', 'numidian-cavalry', 1, -1, 3),
      ],
      { map }
    );
    const reach = unitReach(battle.state, battle.defs, unitOf(battle, 'hastati') as FieldedUnit);

    const stops = [...reach.values()].filter((node) => node.canStop && node.cost > 0);
    expect(stops.length).toBeGreaterThan(10);
    for (const node of stops) {
      const path = pathFromReach(reach, node.hex)!;
      const after = play(battle, move('hastati', ...path.hexes));
      expect(after.events).toMatchObject([{ type: 'UnitMoved', cost: node.cost }]);
    }
    for (const mapHex of hexagonHexes(5)) {
      if (reach.get(`${mapHex.q},${mapHex.r}`)?.canStop) continue;
      const direct = [hex(0, 0), mapHex];
      expect(rejectionOf(battle, move('hastati', ...direct))).not.toBeNull();
    }
  });
});

describe('capturing the camp', () => {
  const camps = { 0: hex(-4, 0), 1: hex(4, 0) };
  const nearCamp = () =>
    battleWith(
      [place('equites', 'equites', 0, 1, 0), place('gauls', 'gallic-mercenaries', 1, -3, 3)],
      { camps }
    );

  it('wins the battle for the side that enters the enemy camp', () => {
    const after = play(nearCamp(), move('equites', ...row(1, 4)));

    expect(after.state).toMatchObject({
      phase: 'ended',
      winner: { player: 0, reason: 'campCaptured' },
    });
    expect(after.events.at(-1)).toEqual({ type: 'BattleEnded', winner: 0, reason: 'campCaptured' });
    expect(rejectionOf(after, END_TURN)).toBe('battleEnded');
  });

  it('does not end the battle when a unit stands in its own camp', () => {
    const atHome = withUnit(nearCamp(), 'equites', { pos: hex(-3, 0) });

    expect(play(atHome, move('equites', ...row(-3, -4))).state.phase).toBe('battle');
  });
});
