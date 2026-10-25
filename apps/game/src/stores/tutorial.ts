import { computed, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import type { GameEvent } from '@vermont/core';
import { TRAINING, opponentOf } from '@vermont/core';
import type { TutorialStep } from '../battle/tutorial';
import { TRAINING_PLAYER, TRAINING_SEED, TUTORIAL_STEPS } from '../battle/tutorial';
import type { ComputerPlayer } from './battle';
import { useBattleStore } from './battle';
import { useSettingsStore } from './settings';

/**
 * The training: a small battle against the easy computer with steps that tell the player what
 * to do next. The steps follow what happens in the battle and never give orders themselves.
 */
export const useTutorialStore = defineStore('tutorial', () => {
  const battle = useBattleStore();
  const settings = useSettingsStore();

  /** Index of the step on the screen; past the last one once the training is over. */
  const stepIndex = ref(0);
  /** The player closed the steps; the training battle goes on without them. */
  const skipped = ref(false);
  /**
   * Whether the training was started in this visit. One picked up from an earlier visit goes
   * on with only the last step.
   */
  const begun = ref(false);
  /** What happened since the current step was shown. */
  const events = shallowRef<readonly GameEvent[]>([]);

  /** Whether the battle on the screen is the training. */
  const inTraining = computed(() => battle.scenario?.id === TRAINING.id);

  const shownIndex = computed(() => (begun.value ? stepIndex.value : TUTORIAL_STEPS.length - 1));

  const step = computed<TutorialStep | null>(() =>
    inTraining.value && !skipped.value ? (TUTORIAL_STEPS[shownIndex.value] ?? null) : null
  );

  /** The training battle is over and the player went through the steps. */
  const finished = computed(
    () => inTraining.value && !skipped.value && shownIndex.value >= TUTORIAL_STEPS.length
  );

  const spot = computed(() => step.value?.spot ?? null);

  /** Starts the training battle from its first step; `hooks` are for tests. */
  function start(hooks: Pick<ComputerPlayer, 'brain' | 'stepDelayMs'> = {}): void {
    battle.start(TRAINING_SEED, TRAINING.id, {
      deployment: 'auto',
      fog: false,
      ai: { player: opponentOf(TRAINING_PLAYER), difficulty: 'easy', ...hooks },
    });
    begun.value = true;
    stepIndex.value = 0;
    skipped.value = false;
    events.value = [];
  }

  function next(): void {
    if (!begun.value) {
      begun.value = true;
      stepIndex.value = TUTORIAL_STEPS.length - 1;
    }
    stepIndex.value++;
    events.value = [];
    // A step may already be done by what happened before it was shown.
    check();
  }

  function skip(): void {
    skipped.value = true;
  }

  /** Moves on when the step on the screen is done. */
  function check(): void {
    const current = step.value;
    const state = battle.known;
    if (!current || current.done === 'next' || !state) return;
    if (current.done({ state, selectedUnitId: battle.selectedUnitId, events: events.value })) {
      if (shownIndex.value === TUTORIAL_STEPS.length - 1) settings.trainingDone = true;
      next();
    }
  }

  watch(
    () => battle.played,
    (played) => {
      if (!played || !step.value) return;
      events.value = [...events.value, ...played.events];
      check();
    }
  );
  watch(() => battle.selectedUnitId, check);

  return {
    player: TRAINING_PLAYER,
    stepIndex: shownIndex,
    stepCount: TUTORIAL_STEPS.length,
    step,
    spot,
    inTraining,
    finished,
    start,
    next,
    skip,
  };
});
