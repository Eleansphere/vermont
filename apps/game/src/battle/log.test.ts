import { describe, expect, it } from 'vitest';
import { SCENARIOS, autoDeployment, dispatchAll, startScenario } from '@vermont/core';
import type { BattleState, GameEvent } from '@vermont/core';
import { describeEvents, lastTurnSummary } from './log';
import type { LogContext, LogEntry } from './log';

const scenario = SCENARIOS.trebia!;
const started = startScenario(scenario, 1);

function deployed(): BattleState {
  let state = started.state;
  while (state.phase === 'deployment') {
    const commands = [...autoDeployment(state, started.defs), { type: 'EndDeployment' } as const];
    state = dispatchAll(state, commands, started.defs).state;
  }
  return state;
}

const battle = deployed();
const context: LogContext = { scenario, defs: started.defs, before: battle, after: battle };
const ORIGIN = { q: 0, r: 0 };

function texts(events: readonly GameEvent[]): string[] {
  return describeEvents(events, context).map((entry) => entry.text);
}

describe('describeEvents', () => {
  it('names the sides by their faction', () => {
    expect(
      texts([
        { type: 'DeploymentEnded', player: 1 },
        { type: 'PhaseChanged', phase: 'battle' },
        { type: 'TurnStarted', player: 0, turn: 3 },
      ])
    ).toEqual(['Kartágo: rozestavení dokončeno.', 'Bitva začíná.', 'Kolo 3, na tahu Řím.']);
  });

  it('numbers units of a type the side has more of', () => {
    const path = (steps: number) => Array.from({ length: steps + 1 }, (_, q) => ({ q, r: 0 }));

    expect(
      texts([
        { type: 'UnitMoved', unitId: 'p0-hastati-2', path: path(1), cost: 1 },
        { type: 'UnitMoved', unitId: 'p1-war-elephants-1', path: path(3), cost: 3 },
        { type: 'UnitMoved', unitId: 'p0-equites-1', path: path(5), cost: 5 },
      ])
    ).toEqual([
      'Hastati 2: přesun o 1 hex.',
      'Váleční sloni: přesun o 3 hexy.',
      'Equites 1: přesun o 5 hexů.',
    ]);
  });

  it('tells of a unit stopped by an enemy in the fog', () => {
    expect(
      texts([
        { type: 'UnitMoved', unitId: 'p0-equites-1', path: [ORIGIN, { q: 1, r: 0 }], cost: 1 },
        { type: 'UnitAmbushed', unitId: 'p0-equites-1', hex: { q: 1, r: 0 } },
      ])
    ).toEqual([
      'Equites 1: přesun o 1 hex.',
      'Equites 1: narazila na skrytého nepřítele a zastavila.',
    ]);
  });

  it('says nothing of an enemy march seen on a single hex', () => {
    expect(
      texts([{ type: 'UnitMoved', unitId: 'p1-war-elephants-1', path: [ORIGIN], cost: 2 }])
    ).toEqual([]);
  });

  it('tells an attack with its answer from shooting', () => {
    expect(
      texts([
        {
          type: 'AttackResolved',
          attackerId: 'p0-triarii-1',
          targetId: 'p1-numidian-cavalry-2',
          kind: 'melee',
          damage: 3,
          counterDamage: 1,
        },
        {
          type: 'AttackResolved',
          attackerId: 'p0-velites-1',
          targetId: 'p1-war-elephants-1',
          kind: 'ranged',
          damage: 2,
          counterDamage: null,
        },
      ])
    ).toEqual([
      'Triarii 1: útok na Numidská jízda 2, ztráty 3. Protiútok 1.',
      'Velité 1: střelba na Váleční sloni, ztráty 2.',
    ]);
  });

  it('reports morale only when the unit changes how it behaves', () => {
    const unitId = 'p1-gallic-mercenaries-1';

    expect(
      texts([
        { type: 'MoraleChanged', unitId, morale: 5, moraleState: 'steady' },
        { type: 'MoraleChanged', unitId, morale: 3, moraleState: 'shaken' },
        { type: 'MoraleChanged', unitId, morale: 2, moraleState: 'shaken' },
        { type: 'MoraleChanged', unitId, morale: 1, moraleState: 'routing' },
      ])
    ).toEqual(['Galští žoldnéři 1: jednotka otřesena.', 'Galští žoldnéři 1: dává se na útěk.']);
  });

  it('announces a draw', () => {
    expect(describeEvents([{ type: 'BattleDrawn' }], context)).toEqual([
      { tone: 'result', player: null, text: 'Remíza: po 20 kolech nikdo nezvítězil.' },
    ]);
  });

  it('says whose line each event is, for its colour', () => {
    const entries = describeEvents(
      [
        { type: 'UnitDied', unitId: 'p1-libyan-spearmen-3', hex: ORIGIN },
        { type: 'UnitFled', unitId: 'p0-velites-2', hex: ORIGIN },
        { type: 'UnitRetreated', unitId: 'p0-velites-2', path: [ORIGIN] },
        { type: 'UnitRallied', unitId: 'p0-velites-2' },
        { type: 'UnitsSwapped', unitId: 'p0-principes-1', targetId: 'p0-triarii-2' },
        { type: 'BattleEnded', winner: 1, reason: 'campCaptured' },
      ],
      context
    );

    expect(entries.map(({ tone, player, text }) => ({ tone, player, text }))).toEqual([
      { tone: 'loss', player: 1, text: 'Libyjští kopiníci 3: jednotka zničena.' },
      { tone: 'loss', player: 0, text: 'Velité 2: opustila bojiště.' },
      { tone: 'morale', player: 0, text: 'Velité 2: ustupuje před nepřítelem.' },
      { tone: 'morale', player: 0, text: 'Velité 2: znovu v boji.' },
      { tone: 'move', player: 0, text: 'Principes 1: střídání linie s Triarii 2.' },
      { tone: 'result', player: 1, text: 'Kartágo vítězí: dobyl tábor soupeře.' },
    ]);
  });

  it('leaves out events that would only clutter the log', () => {
    expect(
      texts([
        { type: 'UnitDeployed', unitId: 'p0-hastati-1', hex: ORIGIN, from: null },
        { type: 'TurnEnded', player: 0, turn: 1 },
        { type: 'UnitDamaged', unitId: 'p0-hastati-1', damage: 2, hp: 8 },
        { type: 'PhaseChanged', phase: 'ended' },
      ])
    ).toEqual([]);
  });
});

describe('places in the log', () => {
  it('marks where each line about a unit happened', () => {
    const target = battle.units['p1-numidian-cavalry-2']!;
    const path = [ORIGIN, { q: 1, r: 0 }, { q: 2, r: 0 }];

    const [moved, attacked, died] = describeEvents(
      [
        { type: 'UnitMoved', unitId: 'p0-equites-1', path, cost: 2 },
        {
          type: 'AttackResolved',
          attackerId: 'p0-triarii-1',
          targetId: target.id,
          kind: 'melee',
          damage: 3,
          counterDamage: 1,
        },
        { type: 'UnitDied', unitId: 'p0-velites-1', hex: { q: 5, r: 5 } },
      ],
      context
    );

    expect(moved).toMatchObject({ unitId: 'p0-equites-1', hex: { q: 2, r: 0 } });
    // An attack is shown where the blow lands.
    expect(attacked!.hex).toEqual('pos' in target ? target.pos : undefined);
    expect(died!.hex).toEqual({ q: 5, r: 5 });
  });
});

describe('lastTurnSummary', () => {
  const line = (entry: Partial<LogEntry> & Pick<LogEntry, 'tone'>): LogEntry => ({
    player: 1,
    text: entry.tone,
    ...entry,
  });
  const HEX = { q: 1, r: 1 };
  const hit = (unitId: string, player: 0 | 1, damage: number) => ({
    unitId,
    label: unitId,
    player,
    damage,
    hex: HEX,
  });

  it('sums up what the opponent did in its last turn, unit by unit, the own ones first', () => {
    const log = [
      line({ tone: 'turn', player: 1, turn: 1 }),
      line({ tone: 'combat', hits: [hit('old', 0, 9)] }),
      line({ tone: 'turn', player: 0, turn: 2 }),
      line({ tone: 'turn', player: 1, turn: 2 }),
      line({ tone: 'move', unitId: 'a' }),
      line({ tone: 'move', unitId: 'a' }),
      line({ tone: 'move', unitId: 'b' }),
      line({ tone: 'combat', unitId: 'gauls', hits: [hit('hastati', 0, 2), hit('gauls', 1, 1)] }),
      line({ tone: 'combat', hits: [hit('hastati', 0, 3)] }),
      line({ tone: 'morale', player: 0, unitId: 'hastati', label: 'hastati', outcome: 'shaken' }),
      line({ tone: 'morale', player: 1, unitId: 'gauls', label: 'gauls', outcome: 'shaken' }),
      line({ tone: 'loss', player: 0, unitId: 'velites', label: 'velites', outcome: 'died' }),
      line({ tone: 'morale', player: 0, unitId: 'velites', label: 'velites', outcome: 'routing' }),
      line({ tone: 'turn', player: 0, turn: 3 }),
    ];

    const summary = lastTurnSummary(log, 1)!;

    expect(summary.opening.turn).toBe(2);
    expect(
      summary.units.map(({ unitId, damage, outcome }) => ({ unitId, damage, outcome }))
    ).toEqual([
      { unitId: 'hastati', damage: 5, outcome: 'shaken' },
      { unitId: 'velites', damage: 0, outcome: 'died' },
      { unitId: 'gauls', damage: 1, outcome: 'shaken' },
    ]);
    expect(summary.units[0]!.hex).toEqual(HEX);
    expect(summary.moves).toBe(2);
  });

  it('has nothing to say when the opponent did nothing the player saw', () => {
    expect(lastTurnSummary([line({ tone: 'turn', player: 1, turn: 1 })], 1)).toBeNull();
    expect(lastTurnSummary([line({ tone: 'turn', player: 0, turn: 1 })], 1)).toBeNull();
  });
});
