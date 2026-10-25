import { onBeforeUnmount, onMounted, watch } from 'vue';
import type { AnimationCue } from '@vermont/render';
import { useBattleStore } from '../stores/battle';
import { useSettingsStore } from '../stores/settings';
import { SoundLimiter, cueSounds, tumultLevel } from './battleSounds';
import { createAudioEngine } from './engine';
import type { PlayOptions } from './engine';
import type { LoopId, SoundId } from './sounds';

/** Where the player is in the game; each place has its own music. */
export type AudioScene = 'menu' | 'battle';

const engine = createAudioEngine(`${import.meta.env.BASE_URL}audio/`);
const limiter = new SoundLimiter();
const PERCENT = 100;
/** Music under a finished battle, quieter so the victory or the defeat is heard over it. */
const AFTER_BATTLE_MUSIC = 0.4;

export function playSound(sound: SoundId, options?: PlayOptions): void {
  if (limiter.allow(sound, engine.now())) engine.play(sound, options);
}

/** Plays what the player hears at a moment of a battle animation. */
export function playCue(cue: AnimationCue): void {
  const store = useBattleStore();
  // While the screen waits for the next player, nothing of the battle should give it away;
  // only the horn of the new turn sounds.
  if (store.handover !== null && cue.kind !== 'turn') return;
  const listener = store.againstComputer ? store.viewer : null;
  for (const { sound, pan, rate } of cueSounds(cue, listener)) playSound(sound, { pan, rate });
}

/** Which loops play, and how loud, in each place of the game. */
function loopLevels(scene: AudioScene): Record<LoopId, number> {
  const levels: Record<LoopId, number> = { menu: 0, calm: 0, battle: 0, field: 0, tumult: 0 };
  if (scene === 'menu') return { ...levels, menu: 1 };

  const store = useBattleStore();
  const shown = store.shown?.state;
  if (!shown) return levels;
  if (shown.phase === 'ended') return { ...levels, field: 1, calm: AFTER_BATTLE_MUSIC };
  const tumult = tumultLevel(shown);
  // Two layers of music: a calm one while the armies close in, the battle theme once they meet.
  return { ...levels, field: 1, tumult, ...(tumult > 0 ? { battle: 1 } : { calm: 1 }) };
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Sets the game's sound going: volumes from the settings, music and ambience for the place the
 * player is in, interface sounds, and the M key to mute. Call once, from the app.
 */
export function useGameAudio(scene: () => AudioScene): void {
  const settings = useSettingsStore();
  const store = useBattleStore();

  function refreshLoops(): void {
    for (const [loop, level] of Object.entries(loopLevels(scene()))) {
      engine.setLoop(loop as LoopId, level);
    }
  }

  function unlock(): void {
    engine.unlock();
    refreshLoops();
  }

  function onKey(event: KeyboardEvent): void {
    unlock();
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (event.code === 'KeyM' && plain && !isTyping(event.target)) settings.muted = !settings.muted;
  }

  function onClick(event: MouseEvent): void {
    if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) {
      playSound('click');
    }
  }

  watch(
    () => {
      const share = (volume: number) => (settings.muted ? 0 : volume / PERCENT);
      return {
        master: share(settings.masterVolume),
        effects: share(settings.effectsVolume),
        music: share(settings.musicVolume),
        ambient: share(settings.ambientVolume),
      };
    },
    (volumes) => engine.setVolumes(volumes),
    { immediate: true }
  );
  watch(() => [scene(), store.shown], refreshLoops);
  watch(
    () => store.selectedUnitId,
    (selected) => {
      if (selected !== null) playSound('select');
    }
  );
  watch(
    () => store.rejection,
    (rejection) => {
      if (rejection) playSound('error');
    }
  );

  onMounted(() => {
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('click', onClick, true);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('click', onClick, true);
  });
}
