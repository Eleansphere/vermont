import type { BattleState, GameEvent, PlayerSlot } from '@vermont/core';
import { adjacentUnits, fieldedUnits, isFighting, opponentOf } from '@vermont/core';
import type { UiKey } from '../i18n';

/** The side the player commands in the training, and the seed it always starts from. */
export const TRAINING_PLAYER: PlayerSlot = 0;
export const TRAINING_SEED = 218;

/** What a step points at on the screen, so the player knows where to look. */
export type TutorialSpot = 'endTurn' | 'unitPanel' | 'log';

/** What the training knows when it checks whether a step is done. */
export interface TutorialContext {
  /** The battle as the player sees it. */
  readonly state: BattleState;
  /** The unit the player has selected, if any. */
  readonly selectedUnitId: string | null;
  /** Everything that happened since the step was shown. */
  readonly events: readonly GameEvent[];
}

export interface TutorialStep {
  readonly id: string;
  readonly text: UiKey;
  /**
   * When the step is done: as soon as the check says so, or when the player clicks on to the
   * next one. A step done by what the player does never waits for a click, so the training
   * does not break when the player does something else first.
   */
  readonly done: ((context: TutorialContext) => boolean) | 'next';
  readonly spot?: TutorialSpot;
}

const ownUnit = (state: BattleState, unitId: string) =>
  state.units[unitId]?.owner === TRAINING_PLAYER;

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'welcome', text: 'tutorial.welcome', done: 'next' },
  {
    id: 'select',
    text: 'tutorial.select',
    spot: 'unitPanel',
    done: ({ state, selectedUnitId }) => selectedUnitId !== null && ownUnit(state, selectedUnitId),
  },
  {
    id: 'move',
    text: 'tutorial.move',
    done: ({ state, events }) =>
      events.some((event) => event.type === 'UnitMoved' && ownUnit(state, event.unitId)),
  },
  {
    id: 'endTurn',
    text: 'tutorial.endTurn',
    spot: 'endTurn',
    done: ({ events }) =>
      events.some((event) => event.type === 'TurnStarted' && event.player === TRAINING_PLAYER),
  },
  {
    id: 'contact',
    text: 'tutorial.contact',
    done: ({ state }) =>
      fieldedUnits(state, TRAINING_PLAYER).some(
        (unit) =>
          isFighting(unit) &&
          adjacentUnits(state, unit.pos, opponentOf(TRAINING_PLAYER)).some(isFighting)
      ),
  },
  {
    id: 'attack',
    text: 'tutorial.attack',
    done: ({ state, events }) =>
      events.some((event) => event.type === 'AttackResolved' && ownUnit(state, event.attackerId)),
  },
  { id: 'morale', text: 'tutorial.morale', done: 'next' },
  { id: 'abilities', text: 'tutorial.abilities', spot: 'unitPanel', done: 'next' },
  { id: 'log', text: 'tutorial.log', spot: 'log', done: 'next' },
  {
    id: 'finish',
    text: 'tutorial.finish',
    done: ({ state }) => state.phase === 'ended',
  },
];
