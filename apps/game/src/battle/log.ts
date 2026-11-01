import type {
  BattleDefs,
  BattleState,
  GameEvent,
  Hex,
  MoraleState,
  PlayerSlot,
  ScenarioDef,
} from '@vermont/core';
import { isFielded } from '@vermont/core';
import { plural, t, victoryReasonText } from '../i18n';
import { sideName, unitLabel } from './labels';

export type LogTone = 'turn' | 'move' | 'combat' | 'morale' | 'loss' | 'result';

/** What became of a unit: its new morale, or that it left the field. */
export type UnitOutcome = MoraleState | 'died' | 'fled';

/** Damage one unit took. */
export interface Hit {
  readonly unitId: string;
  readonly label: string;
  readonly player: PlayerSlot;
  readonly damage: number;
  readonly hex?: Hex;
}

/** One line of the event log. */
export interface LogEntry {
  readonly tone: LogTone;
  /** The side the line is about; `null` when it is about the battle as a whole. */
  readonly player: PlayerSlot | null;
  readonly text: string;
  /** The unit the line is about, if any, and its name. */
  readonly unitId?: string;
  readonly label?: string;
  /** Damage the line tells of, unit by unit: a blow and the answer to it. */
  readonly hits?: readonly Hit[];
  /** What became of the unit, on lines that tell it. */
  readonly outcome?: UnitOutcome;
  /** Where on the map it happened, for lines about a unit. */
  readonly hex?: Hex;
  /** The round, on the line that opens a side's turn. */
  readonly turn?: number;
}

export interface LogContext {
  readonly scenario: ScenarioDef;
  readonly defs: BattleDefs;
  /** The whole state the events started from; a player's view has no names for hidden units. */
  readonly before: BattleState;
  /** The whole state after the events. */
  readonly after: BattleState;
}

/**
 * Says what happened in words for the player. Events that would only repeat another line or
 * clutter the log (a unit put on the map, every single point of morale) give no line.
 */
export function describeEvents(events: readonly GameEvent[], context: LogContext): LogEntry[] {
  const { scenario, defs, before, after } = context;
  const moraleStates = new Map<string, MoraleState>();
  const unit = (unitId: string) => after.units[unitId]!;
  const label = (unitId: string) => unitLabel(after, defs, unit(unitId));
  /** Where the unit is after the events, or where it was last when it left the field. */
  const place = (unitId: string): Hex | undefined => {
    const now = after.units[unitId];
    const earlier = before.units[unitId];
    if (now && isFielded(now)) return now.pos;
    return earlier && isFielded(earlier) ? earlier.pos : undefined;
  };
  const aboutUnit = (
    tone: LogTone,
    unitId: string,
    text: string,
    extra: { at?: Hex; hits?: readonly Hit[]; outcome?: UnitOutcome } = {}
  ): LogEntry => {
    const hex = extra.at ?? place(unitId);
    return {
      tone,
      player: unit(unitId).owner,
      text,
      unitId,
      label: label(unitId),
      ...(hex && { hex }),
      ...(extra.hits && { hits: extra.hits }),
      ...(extra.outcome && { outcome: extra.outcome }),
    };
  };
  const hit = (unitId: string, damage: number): Hit => {
    const hex = place(unitId);
    return {
      unitId,
      label: label(unitId),
      player: unit(unitId).owner,
      damage,
      ...(hex && { hex }),
    };
  };

  const entries: LogEntry[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'DeploymentEnded':
        entries.push({
          tone: 'turn',
          player: event.player,
          text: t('log.deploymentEnded', { side: sideName(scenario, event.player) }),
        });
        break;
      case 'PhaseChanged':
        if (event.phase === 'battle') {
          entries.push({ tone: 'turn', player: null, text: t('log.battleStarts') });
        }
        break;
      case 'TurnStarted':
        entries.push({
          tone: 'turn',
          player: event.player,
          turn: event.turn,
          text: t('log.turnStarted', {
            turn: event.turn,
            side: sideName(scenario, event.player),
          }),
        });
        break;
      case 'UnitMoved': {
        const count = event.path.length - 1;
        // An enemy seen on a single hex of its march: there is no stretch to speak of.
        if (count === 0) break;
        entries.push(
          aboutUnit(
            'move',
            event.unitId,
            t('log.moved', { unit: label(event.unitId), count, hexes: plural('hexes', count) }),
            { at: event.path.at(-1) }
          )
        );
        break;
      }
      case 'UnitAmbushed':
        entries.push(
          aboutUnit('move', event.unitId, t('log.ambushed', { unit: label(event.unitId) }))
        );
        break;
      case 'UnitDisengaged':
        entries.push(
          aboutUnit(
            'combat',
            event.unitId,
            t('log.disengaged', {
              unit: label(event.unitId),
              striker: label(event.strikerId),
              damage: event.damage,
            }),
            { at: place(event.unitId), hits: [hit(event.unitId, event.damage)] }
          )
        );
        break;
      case 'AttackResolved': {
        const attack = t(event.kind === 'ranged' ? 'log.attack.ranged' : 'log.attack.melee', {
          unit: label(event.attackerId),
          target: label(event.targetId),
          damage: event.damage,
        });
        const manner = (event.charge ? t('log.charge') : '') + (event.rear ? t('log.rear') : '');
        const counter =
          manner +
          (event.counterDamage === null ? '' : t('log.counter', { damage: event.counterDamage }));
        const hits = [hit(event.targetId, event.damage)];
        if (event.counterDamage !== null) hits.push(hit(event.attackerId, event.counterDamage));
        entries.push(
          aboutUnit('combat', event.attackerId, attack + counter, {
            at: place(event.targetId),
            hits,
          })
        );
        break;
      }
      case 'UnitDied':
        entries.push(
          aboutUnit('loss', event.unitId, t('log.died', { unit: label(event.unitId) }), {
            at: event.hex,
            outcome: 'died',
          })
        );
        break;
      case 'MoraleChanged': {
        const previous = moraleStates.get(event.unitId) ?? before.units[event.unitId]?.moraleState;
        moraleStates.set(event.unitId, event.moraleState);
        if (previous === event.moraleState) break;
        entries.push(
          aboutUnit(
            'morale',
            event.unitId,
            t(`log.morale.${event.moraleState}`, { unit: label(event.unitId) }),
            { outcome: event.moraleState }
          )
        );
        break;
      }
      case 'UnitsSwapped':
        entries.push(
          aboutUnit(
            'move',
            event.unitId,
            t('log.swapped', { unit: label(event.unitId), target: label(event.targetId) })
          )
        );
        break;
      case 'UnitRampaged':
        entries.push(
          aboutUnit(
            'combat',
            event.unitId,
            t('log.rampaged', {
              unit: label(event.unitId),
              target: label(event.targetId),
              damage: event.damage,
            }),
            { at: place(event.targetId), hits: [hit(event.targetId, event.damage)] }
          )
        );
        break;
      case 'UnitRetreated':
        entries.push(
          aboutUnit('morale', event.unitId, t('log.retreated', { unit: label(event.unitId) }))
        );
        break;
      case 'UnitRallied':
        entries.push(
          aboutUnit('morale', event.unitId, t('log.rallied', { unit: label(event.unitId) }))
        );
        break;
      case 'UnitFled':
        entries.push(
          aboutUnit('loss', event.unitId, t('log.fled', { unit: label(event.unitId) }), {
            at: event.hex,
            outcome: 'fled',
          })
        );
        break;
      case 'BattleEnded':
        entries.push({
          tone: 'result',
          player: event.winner,
          text: t('log.battleEnded', {
            side: sideName(scenario, event.winner),
            reason: victoryReasonText(event.reason),
          }),
        });
        break;
      case 'BattleDrawn':
        entries.push({
          tone: 'result',
          player: null,
          text: t('log.battleDrawn', { rounds: defs.rules.roundLimit }),
        });
        break;
      case 'UnitDeployed':
      case 'TurnEnded':
      case 'UnitDamaged':
        break;
    }
  }
  return entries;
}

/** What one unit went through in a turn: the damage it took and what became of it. */
export interface UnitDigest {
  readonly unitId: string;
  readonly label: string;
  readonly player: PlayerSlot;
  readonly damage: number;
  readonly outcome: UnitOutcome | null;
  readonly hex?: Hex;
}

/** What the other side did in its last turn, as the player saw it. */
export interface TurnSummary {
  /** The line that opened that turn. */
  readonly opening: LogEntry;
  /** Every unit hurt or shaken in it, the player's own first, each once. */
  readonly units: readonly UnitDigest[];
  /** How many of its units the player saw march. */
  readonly moves: number;
}

/** Sums up lines unit by unit; a unit that left the field keeps that as its outcome. */
export function digestUnits(lines: readonly LogEntry[]): UnitDigest[] {
  const units = new Map<string, UnitDigest>();
  const touch = (unitId: string, label: string, player: PlayerSlot, hex?: Hex): UnitDigest => {
    const known = units.get(unitId);
    const digest = known ?? { unitId, label, player, damage: 0, outcome: null };
    const placed = hex ? { ...digest, hex } : digest;
    units.set(unitId, placed);
    return placed;
  };
  for (const line of lines) {
    for (const blow of line.hits ?? []) {
      const digest = touch(blow.unitId, blow.label, blow.player, blow.hex);
      units.set(blow.unitId, { ...digest, damage: digest.damage + blow.damage });
    }
    if (line.outcome && line.unitId && line.label && line.player !== null) {
      const digest = touch(line.unitId, line.label, line.player, line.hex);
      const gone = digest.outcome === 'died' || digest.outcome === 'fled';
      if (!gone) units.set(line.unitId, { ...digest, outcome: line.outcome });
    }
  }
  return [...units.values()].filter((digest) => digest.damage > 0 || digest.outcome !== null);
}

/**
 * The opponent's last turn in the player's log: the lines after the last opening of a turn of
 * the opponent, up to the next opening, unit by unit. `null` when the player saw nothing
 * happen in it.
 */
export function lastTurnSummary(
  log: readonly LogEntry[],
  opponent: PlayerSlot
): TurnSummary | null {
  const start = log.findLastIndex(
    (entry) => entry.tone === 'turn' && entry.turn !== undefined && entry.player === opponent
  );
  if (start === -1) return null;
  const end = log.findIndex((entry, index) => index > start && entry.tone === 'turn');
  const turn = log.slice(start + 1, end === -1 ? undefined : end);
  const digest = digestUnits(turn);
  const units = [
    ...digest.filter((unit) => unit.player !== opponent),
    ...digest.filter((unit) => unit.player === opponent),
  ];
  const moves = new Set(turn.filter((entry) => entry.tone === 'move').map((entry) => entry.unitId))
    .size;
  if (units.length === 0 && moves === 0) return null;
  return { opening: log[start]!, units, moves };
}
