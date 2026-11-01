import type { Channel, LoopId, SoundId } from './sounds';
import { LOOPS, SOUNDS } from './sounds';

/** Volumes from 0 to 1. */
export interface Volumes {
  readonly master: number;
  readonly effects: number;
  readonly music: number;
  readonly ambient: number;
}

export interface PlayOptions {
  readonly pan?: number;
  readonly rate?: number;
}

/** Plays the game's sounds; does nothing where the browser has no Web Audio. */
export interface AudioEngine {
  /**
   * Browsers let sound play only after the player did something; call on a click or a key. The
   * short sounds, half a megabyte together, are loaded then, so that none is missed later.
   */
  unlock(): void;
  setVolumes(volumes: Volumes): void;
  /** Stops all sound while the game is out of sight, such as in a background tab. */
  setHidden(hidden: boolean): void;
  /** Plays a sound once; a sound not loaded yet is skipped, and loaded for the next time. */
  play(sound: SoundId, options?: PlayOptions): void;
  /** Fades a loop to a share of its volume over `seconds`; at 0 it stops. */
  setLoop(loop: LoopId, level: number, seconds?: number): void;
  /** Seconds since the engine started; for the limiter. */
  now(): number;
}

/** How far each playback of a short sound may stray in speed, so repeats differ. */
const RATE_SPREAD = 0.08;
const DEFAULT_FADE_SECONDS = 2;

interface PlayingLoop {
  readonly gain: GainNode;
  source: AudioBufferSourceNode | null;
  level: number;
}

/** The engine on Web Audio; files are fetched from `baseUrl` when first needed. */
export function createAudioEngine(baseUrl: string): AudioEngine {
  if (typeof AudioContext === 'undefined') return silentEngine();

  let context: AudioContext | null = null;
  let output: GainNode | null = null;
  const channels = new Map<Channel, GainNode>();
  const buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();
  const loops = new Map<LoopId, PlayingLoop>();
  let volumes: Volumes = { master: 1, effects: 1, music: 1, ambient: 1 };

  /** The context is made on the first unlock; before that nothing may play anyway. */
  function ready(): AudioContext | null {
    return context?.state === 'running' ? context : null;
  }

  function applyVolumes(): void {
    if (!context || !output) return;
    const time = context.currentTime;
    output.gain.setTargetAtTime(volumes.master, time, 0.05);
    for (const [channel, gain] of channels) gain.gain.setTargetAtTime(volumes[channel], time, 0.05);
  }

  function load(file: string): AudioBuffer | null {
    const known = buffers.get(file);
    if (known instanceof AudioBuffer) return known;
    if (known || !context) return null;
    buffers.set(file, 'loading');
    const decoder = context;
    void fetch(baseUrl + file)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${file}`);
        return response.arrayBuffer();
      })
      .then((data) => decoder.decodeAudioData(data))
      .then((buffer) => {
        buffers.set(file, buffer);
        // A loop asked for while its file was on the way starts now.
        for (const [id, loop] of loops) {
          if (LOOPS[id].file === file && loop.level > 0 && !loop.source) startLoop(id, loop);
        }
      })
      .catch((error: unknown) => {
        buffers.set(file, 'failed');
        console.warn('A sound could not be loaded.', error);
      });
    return null;
  }

  function startLoop(id: LoopId, loop: PlayingLoop): void {
    const audio = ready();
    const buffer = load(LOOPS[id].file);
    if (!audio || !buffer) return;
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(loop.gain);
    source.start();
    loop.source = source;
  }

  return {
    unlock() {
      if (!context) {
        context = new AudioContext();
        output = context.createGain();
        output.connect(context.destination);
        for (const channel of ['effects', 'ambient', 'music'] as const) {
          const gain = context.createGain();
          gain.connect(output);
          channels.set(channel, gain);
        }
        applyVolumes();
        for (const sound of Object.values(SOUNDS)) for (const file of sound.files) load(file);
      }
      if (context.state === 'suspended') {
        void context.resume().then(() => {
          for (const [id, loop] of loops) if (loop.level > 0 && !loop.source) startLoop(id, loop);
        });
      }
    },
    setVolumes(next) {
      volumes = next;
      applyVolumes();
    },
    setHidden(hidden) {
      if (!context) return;
      if (hidden) void context.suspend();
      else void context.resume();
    },
    play(sound, { pan = 0, rate = 1 } = {}) {
      const audio = ready();
      const def = SOUNDS[sound];
      const file = def.files[Math.floor(Math.random() * def.files.length)]!;
      const buffer = load(file);
      if (!audio || !buffer) return;
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * RATE_SPREAD);
      const gain = audio.createGain();
      gain.gain.value = def.gain;
      const panner = audio.createStereoPanner();
      panner.pan.value = pan;
      source.connect(gain).connect(panner).connect(channels.get('effects')!);
      source.start();
    },
    setLoop(id, level, seconds = DEFAULT_FADE_SECONDS) {
      if (!context) return;
      let loop = loops.get(id);
      if (!loop) {
        if (level <= 0) return;
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(channels.get(LOOPS[id].channel)!);
        loop = { gain, source: null, level: 0 };
        loops.set(id, loop);
      }
      if (loop.level === level) return;
      loop.level = level;
      const time = context.currentTime;
      const target = LOOPS[id].gain * level;
      loop.gain.gain.cancelScheduledValues(time);
      loop.gain.gain.setValueAtTime(loop.gain.gain.value, time);
      loop.gain.gain.linearRampToValueAtTime(target, time + seconds);
      if (level > 0) {
        if (!loop.source) startLoop(id, loop);
      } else if (loop.source) {
        loop.source.stop(time + seconds);
        loop.source = null;
      }
    },
    now: () => context?.currentTime ?? 0,
  };
}

function silentEngine(): AudioEngine {
  return {
    unlock: () => undefined,
    setHidden: () => undefined,
    setVolumes: () => undefined,
    play: () => undefined,
    setLoop: () => undefined,
    now: () => 0,
  };
}
