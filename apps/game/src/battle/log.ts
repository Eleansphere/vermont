import type {
  BattleDefs,
  BattleState,
  GameEvent,
  MoraleState,
  PlayerSlot,
  ScenarioDef,
} from '@vermont/core';
import { plural, t, victoryReasonText } from '../i18n';
import { sideName, unitLabel } from './labels';

export type LogTone = 'turn' | 'move' | 'combat' | 'morale' | 'loss' | 'result';

/** One line of the event log. */
export interface LogEntry {
  readonly tone: LogTone;
  /** The side the line is about; `null` when it is about the battle as a whole. */
  readonly player: PlayerSlot | null;
  readonly text: string;
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
  const aboutUnit = (tone: LogTone, unitId: string, text: string): LogEntry => ({
    tone,
    player: unit(unitId).owner,
    text,
  });

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
            t('log.moved', { unit: label(event.unitId), count, hexes: plural('hexes', count) })
          )
        );
        break;
      }
      case 'UnitAmbushed':
        entries.push(
          aboutUnit('move', event.unitId, t('log.ambushed', { unit: label(event.unitId) }))
        );
        break;
      case 'AttackResolved': {
        const attack = t(event.kind === 'ranged' ? 'log.attack.ranged' : 'log.attack.melee', {
          unit: label(event.attackerId),
          target: label(event.targetId),
          damage: event.damage,
        });
        const counter =
          event.counterDamage === null ? '' : t('log.counter', { damage: event.counterDamage });
        entries.push(aboutUnit('combat', event.attackerId, attack + counter));
        break;
      }
      case 'UnitDied':
        entries.push(aboutUnit('loss', event.unitId, t('log.died', { unit: label(event.unitId) })));
        break;
      case 'MoraleChanged': {
        const previous = moraleStates.get(event.unitId) ?? before.units[event.unitId]?.moraleState;
        moraleStates.set(event.unitId, event.moraleState);
        if (previous === event.moraleState) break;
        entries.push(
          aboutUnit(
            'morale',
            event.unitId,
            t(`log.morale.${event.moraleState}`, { unit: label(event.unitId) })
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
        entries.push(aboutUnit('loss', event.unitId, t('log.fled', { unit: label(event.unitId) })));
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
      case 'UnitDeployed':
      case 'TurnEnded':
      case 'UnitDamaged':
        break;
    }
  }
  return entries;
}
