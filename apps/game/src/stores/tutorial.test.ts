import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { TRAINING, fieldedUnits } from '@vermont/core';
import { createLocalBrain } from '../ai/brain';
import { TUTORIAL_STEPS } from '../battle/tutorial';
import { useBattleStore } from './battle';
import { useSettingsStore } from './settings';
import { useTutorialStore } from './tutorial';

function startTraining() {
  const tutorial = useTutorialStore();
  tutorial.start({ brain: createLocalBrain(), stepDelayMs: 0 });
  return { tutorial, battle: useBattleStore() };
}

const stepId = (tutorial: ReturnType<typeof useTutorialStore>) => tutorial.step?.id;

describe('tutorial store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts the training with both armies on the field and the first step shown', async () => {
    const { tutorial, battle } = startTraining();

    expect(battle.scenario?.id).toBe(TRAINING.id);
    await vi.waitFor(() => expect(battle.aiOnTurn).toBe(false));
    expect(battle.state).toMatchObject({ phase: 'battle', turn: 1, activePlayer: 0 });
    expect(fieldedUnits(battle.state!, 0)).toHaveLength(4);
    expect(fieldedUnits(battle.state!, 1)).toHaveLength(4);
    expect(stepId(tutorial)).toBe('welcome');
    expect(tutorial.inTraining).toBe(true);
  });

  it('moves on when the player does what the step asks', async () => {
    const { tutorial, battle } = startTraining();
    await vi.waitFor(() => expect(battle.aiOnTurn).toBe(false));
    tutorial.next();
    expect(stepId(tutorial)).toBe('select');

    const unit = fieldedUnits(battle.state!, 0)[0]!;
    battle.select(unit.id);
    await vi.waitFor(() => expect(stepId(tutorial)).toBe('move'));

    const goal = battle.highlights.reach!.at(-1)!;
    battle.pick({ hex: goal });
    await vi.waitFor(() => expect(stepId(tutorial)).toBe('endTurn'));
    expect(tutorial.spot).toBe('endTurn');

    battle.endTurn();
    await vi.waitFor(() => expect(battle.aiOnTurn).toBe(false), { timeout: 20_000 });
    await vi.waitFor(() => expect(['contact', 'attack']).toContain(stepId(tutorial)));
  }, 30_000);

  it('can be hidden while the training battle goes on', () => {
    const { tutorial, battle } = startTraining();

    tutorial.skip();

    expect(tutorial.step).toBeNull();
    expect(tutorial.finished).toBe(false);
    expect(battle.scenario?.id).toBe(TRAINING.id);
  });

  it('shows only the last step for a training picked up from an earlier visit', () => {
    const battle = useBattleStore();
    battle.start(1, TRAINING.id, { deployment: 'auto', fog: false });
    const tutorial = useTutorialStore();

    expect(stepId(tutorial)).toBe(TUTORIAL_STEPS.at(-1)!.id);
  });

  it('marks the training done once the battle is over', async () => {
    const { tutorial } = startTraining();
    const settings = useSettingsStore();
    // Straight to the last step, which waits for the end of the battle.
    for (let index = 0; index < TUTORIAL_STEPS.length - 1; index++) tutorial.next();
    expect(stepId(tutorial)).toBe('finish');
    expect(settings.trainingDone).toBe(false);

    const battle = useBattleStore();
    battle.state = { ...battle.state!, phase: 'ended' };
    battle.select(fieldedUnits(battle.state, 0)[0]!.id);

    await vi.waitFor(() => expect(tutorial.finished).toBe(true));
    expect(settings.trainingDone).toBe(true);
  });
});
