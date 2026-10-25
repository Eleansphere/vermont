/** Which volume a sound follows. Interface sounds go with the effects. */
export type Channel = 'effects' | 'ambient' | 'music';

export interface SoundDef {
  /** Variants; one is picked at random each time, so repeats do not sound the same. */
  readonly files: readonly string[];
  /** Loudness against the other sounds of its channel, from 0 to 1. */
  readonly gain: number;
}

const variants = (name: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `sfx/${name}-${index + 1}.ogg`);

/** Short sounds, played once. Paths are relative to the `audio` folder. */
export const SOUNDS = {
  step: { files: variants('step', 4), gain: 0.35 },
  trot: { files: variants('trot', 2), gain: 0.5 },
  stomp: { files: variants('stomp', 2), gain: 0.55 },
  clash: { files: variants('clash', 4), gain: 0.7 },
  charge: { files: variants('charge', 2), gain: 0.5 },
  throw: { files: variants('throw', 3), gain: 0.45 },
  land: { files: variants('land', 3), gain: 0.5 },
  hurt: { files: variants('hurt', 4), gain: 0.35 },
  fall: { files: variants('fall', 3), gain: 0.45 },
  rout: { files: ['sfx/rout.ogg'], gain: 0.45 },
  rally: { files: ['sfx/rally.ogg'], gain: 0.4 },
  trumpet: { files: ['sfx/trumpet.ogg'], gain: 0.6 },
  ambush: { files: ['sfx/ambush.ogg'], gain: 0.45 },
  horn0: { files: ['sfx/horn-1.ogg'], gain: 0.4 },
  horn1: { files: ['sfx/horn-2.ogg'], gain: 0.4 },
  victory: { files: ['sfx/victory.ogg'], gain: 0.9 },
  defeat: { files: ['sfx/defeat.ogg'], gain: 0.9 },
  draw: { files: ['sfx/draw.ogg'], gain: 0.7 },
  click: { files: ['ui/click.ogg'], gain: 0.4 },
  select: { files: ['ui/select.ogg'], gain: 0.35 },
  error: { files: ['ui/error.ogg'], gain: 0.4 },
} as const satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

export interface LoopDef {
  readonly file: string;
  readonly channel: Exclude<Channel, 'effects'>;
  readonly gain: number;
}

/** Sounds that play over and over: the battlefield and the music. */
export const LOOPS = {
  field: { file: 'ambient/field.ogg', channel: 'ambient', gain: 0.6 },
  tumult: { file: 'ambient/tumult.ogg', channel: 'ambient', gain: 0.7 },
  menu: { file: 'music/menu.ogg', channel: 'music', gain: 0.8 },
  calm: { file: 'music/calm.ogg', channel: 'music', gain: 0.7 },
  battle: { file: 'music/battle.ogg', channel: 'music', gain: 0.8 },
} as const satisfies Record<string, LoopDef>;

export type LoopId = keyof typeof LOOPS;

/** Every file the game plays, for the test that they are shipped. */
export function audioFiles(): string[] {
  return [
    ...Object.values(SOUNDS).flatMap((sound) => sound.files),
    ...Object.values(LOOPS).map((loop) => loop.file),
  ];
}
