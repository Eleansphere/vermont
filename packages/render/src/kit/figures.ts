import type { AnimationAction, AnimationClip, BufferGeometry, Object3D } from 'three';
import { AnimationMixer, Group, LoopOnce, LoopRepeat, Mesh, MeshStandardMaterial } from 'three';
import type { PlayerSlot, UnitTypeDef } from '@vermont/core';
import { PLAYER_COLORS } from '../palette';
import type { UnitModel, UnitModelFactory, UnitPose } from '../unitModels';
import { placeholderUnitModel } from '../unitModels';
import type { BakedFigure, CharacterSource, Gear, PartFilter } from './bake';
import { bakeFigure, instantiate } from './bake';
import type { Mount } from './gear';
import {
  banner,
  conicalHelmet,
  crest,
  elephant,
  helmetBowl,
  mounted,
  ovalShield,
  roundShield,
  scutum,
  spear,
} from './gear';

/** The loaded characters the figures are made from; all humans share one rig. */
export interface UnitKit {
  readonly king: CharacterSource;
  readonly adventurer: CharacterSource;
  readonly hooded: CharacterSource;
  readonly horse: CharacterSource;
}

type Body = 'king' | 'adventurer' | 'hooded';
/** What a unit's figures ride. */
type Steed = 'horse' | 'elephant';

/** How one unit type is dressed and how many figures stand on its hex. */
export interface FigureRecipe {
  readonly body: Body;
  /** Figures at full strength. */
  readonly count: number;
  /** What the figures ride; riders are drawn from the waist up. */
  readonly mount?: Steed;
  /** The figures throw or sling instead of striking. */
  readonly ranged?: boolean;
  readonly filter: (side: number) => PartFilter;
  readonly gear: (side: number) => readonly Gear[];
}

/** Height of a figure standing on the ground, in world units; a hex is 2 across. */
export const FIGURE_HEIGHT = 0.72;
const HORSE_LENGTH = 0.95;
/** How high a rider's hips sit above the ground. */
const SADDLE_HEIGHT = 0.34;
const FADE_SECONDS = 0.15;

const BRONZE = 0xb08d4a;
const IRON = 0x8c9096;
const WOOD = 0x6e4f33;
const CREST_BLACK = 0x23201e;
const CREST_RED = 0xb02a22;
const DARK_HAIR = 0x3b2a1e;

/** Side colour, a bit darker, for cloth that should not glow next to the shields. */
function cloth(side: number): number {
  const r = ((side >> 16) & 0xff) * 0.8;
  const g = ((side >> 8) & 0xff) * 0.8;
  const b = (side & 0xff) * 0.8;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// Bones of the Quaternius rig. The hands point along +y in their own frames.
const HEAD = 'Head';
const LEFT_HAND = 'WristL';
const RIGHT_HAND = 'WristR';

const kingFilter = (side: number): PartFilter => ({
  withoutMaterials: /^Gold$/,
  recolor: [
    [/^Blue$/, cloth(side)],
    [/^Hair_White$/, DARK_HAIR],
  ],
});
const adventurerFilter = (side: number): PartFilter => ({
  withoutMeshes: /Backpack/,
  recolor: [
    [/^Green$/, cloth(side)],
    [/^LightGreen$/, side],
  ],
});
const hoodedFilter = (side: number): PartFilter => ({
  withoutMeshes: /^Sword$/,
  recolor: [[/^LightBrown$/, cloth(side)]],
});

const shieldOnArm: Mount = { at: [0, 0.06, 0.05] };
const spearInHand: Mount = { at: [0, 0.03, 0.02], turn: [Math.PI / 2, 0, 0] };

function romanHelmet(crestColor: number, crestHeight: number): Gear[] {
  return [
    { bone: HEAD, geometry: mounted(helmetBowl(), { at: [0, 0.1, 0] }), color: BRONZE },
    { bone: HEAD, geometry: mounted(crest(crestHeight), { at: [0, 0.1, 0] }), color: crestColor },
  ];
}

const punicHelmet = (): Gear => ({
  bone: HEAD,
  geometry: mounted(conicalHelmet(), { at: [0, 0.1, 0] }),
  color: IRON,
});

/** The recipes by unit type; an archetype the table lacks falls back to a placeholder. */
export const FIGURE_RECIPES: Readonly<Record<string, FigureRecipe>> = {
  hastati: {
    body: 'king',
    count: 4,
    filter: kingFilter,
    gear: (side) => [
      ...romanHelmet(CREST_BLACK, 0.05),
      { bone: LEFT_HAND, geometry: mounted(scutum(), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(0.6), spearInHand), color: WOOD },
    ],
  },
  principes: {
    body: 'king',
    count: 4,
    filter: kingFilter,
    gear: (side) => [
      ...romanHelmet(CREST_RED, 0.09),
      { bone: LEFT_HAND, geometry: mounted(scutum(), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(0.6), spearInHand), color: WOOD },
    ],
  },
  triarii: {
    body: 'king',
    count: 4,
    filter: kingFilter,
    gear: (side) => [
      ...romanHelmet(CREST_RED, 0.05),
      { bone: LEFT_HAND, geometry: mounted(scutum(), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(1.3), spearInHand), color: WOOD },
    ],
  },
  velites: {
    body: 'adventurer',
    count: 4,
    filter: adventurerFilter,
    gear: (side) => [
      { bone: LEFT_HAND, geometry: mounted(roundShield(0.11), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(0.55), spearInHand), color: WOOD },
    ],
  },
  equites: {
    body: 'king',
    count: 2,
    mount: 'horse',
    filter: kingFilter,
    gear: (side) => [
      ...romanHelmet(CREST_RED, 0.07),
      { bone: LEFT_HAND, geometry: mounted(roundShield(0.13), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(1), spearInHand), color: WOOD },
    ],
  },
  'balearic-slingers': {
    body: 'hooded',
    count: 4,
    ranged: true,
    filter: hoodedFilter,
    gear: () => [],
  },
  'libyan-spearmen': {
    body: 'king',
    count: 4,
    filter: kingFilter,
    gear: (side) => [
      punicHelmet(),
      { bone: LEFT_HAND, geometry: mounted(roundShield(0.15), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(1.3), spearInHand), color: WOOD },
    ],
  },
  'gallic-mercenaries': {
    body: 'adventurer',
    count: 4,
    filter: adventurerFilter,
    gear: (side) => [
      { bone: LEFT_HAND, geometry: mounted(ovalShield(), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(0.5), spearInHand), color: IRON },
    ],
  },
  'numidian-cavalry': {
    body: 'adventurer',
    count: 2,
    mount: 'horse',
    filter: adventurerFilter,
    gear: (side) => [
      { bone: LEFT_HAND, geometry: mounted(roundShield(0.1), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(0.6), spearInHand), color: WOOD },
    ],
  },
  'war-elephants': {
    body: 'adventurer',
    count: 1,
    mount: 'elephant',
    filter: adventurerFilter,
    gear: () => [{ bone: RIGHT_HAND, geometry: mounted(spear(0.45), spearInHand), color: WOOD }],
  },
  'iberian-cavalry': {
    body: 'king',
    count: 2,
    mount: 'horse',
    filter: kingFilter,
    gear: (side) => [
      punicHelmet(),
      { bone: LEFT_HAND, geometry: mounted(roundShield(0.13), shieldOnArm), color: side },
      { bone: RIGHT_HAND, geometry: mounted(spear(1), spearInHand), color: WOOD },
    ],
  },
};

/** Clip names of the rigs, by pose; the first that exists is played. */
const HUMAN_CLIPS: Readonly<Record<UnitPose, readonly string[]>> = {
  idle: ['Idle_Sword', 'Idle'],
  walk: ['Run', 'Walk'],
  attack: ['Sword_Slash', 'Punch_Right'],
  shoot: ['Punch_Right', 'Sword_Slash'],
  hit: ['HitRecieve', 'HitRecieve_2'],
  death: ['Death'],
};
const RIDER_CLIPS: Readonly<Record<UnitPose, readonly string[]>> = {
  ...HUMAN_CLIPS,
  walk: ['Idle_Sword', 'Idle'],
};
const HORSE_CLIPS: Readonly<Record<UnitPose, readonly string[]>> = {
  idle: ['Idle', 'Idle_2'],
  walk: ['Gallop', 'Walk'],
  attack: ['Attack_Headbutt', 'Attack_Kick'],
  shoot: ['Idle'],
  hit: ['Idle_HitReact_Left', 'Idle_HitReact_Right'],
  death: ['Death'],
};

/** The clip named `name`, also when the exporter put the armature's name in front. */
export function findClip(
  clips: readonly AnimationClip[],
  names: readonly string[]
): AnimationClip | undefined {
  for (const name of names) {
    const clip =
      clips.find((candidate) => candidate.name === name) ??
      clips.find((candidate) => candidate.name.endsWith(`|${name}`));
    if (clip) return clip;
  }
  return undefined;
}

/** Where the figures of a unit stand on its hex, facing +z. */
export function formation(count: number): readonly (readonly [number, number])[] {
  if (count === 1) return [[0, 0]];
  if (count === 2)
    return [
      [-0.3, 0.05],
      [0.3, -0.05],
    ];
  if (count === 3)
    return [
      [0, 0.24],
      [-0.28, -0.2],
      [0.28, -0.2],
    ];
  return [
    [-0.25, 0.24],
    [0.25, 0.24],
    [-0.27, -0.24],
    [0.27, -0.24],
  ];
}

/** How many of a unit's figures still stand: rounded up, so the last falls with the unit. */
export function figuresLeft(count: number, share: number): number {
  if (share <= 0) return 0;
  return Math.min(count, Math.max(1, Math.ceil(count * share - 1e-9)));
}

interface Actor {
  readonly mixer: AnimationMixer;
  readonly clips: Readonly<Record<UnitPose, readonly string[]>>;
  readonly animations: readonly AnimationClip[];
  current?: AnimationAction;
}

function play(actor: Actor, pose: UnitPose, offset = 0): void {
  const clip = findClip(actor.animations, actor.clips[pose]);
  if (!clip) return;
  const action = actor.mixer.clipAction(clip);
  const once = pose === 'attack' || pose === 'shoot' || pose === 'hit' || pose === 'death';
  action.reset();
  action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = pose === 'death';
  action.time = offset * clip.duration;
  if (actor.current && actor.current !== action)
    action.crossFadeFrom(actor.current, FADE_SECONDS, false);
  action.play();
  actor.current = action;
  if (once && pose !== 'death') {
    const back = (event: { action: AnimationAction }) => {
      if (event.action !== action) return;
      actor.mixer.removeEventListener('finished', back);
      if (actor.current === action) play(actor, 'idle');
    };
    actor.mixer.addEventListener('finished', back);
  }
}

/** A small deterministic scatter, so the figures do not stand like a grid. */
function scatter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Where a unit's standard stands: at the back of the hex, beside the figures. */
const BANNER_SPOT = [0.42, -0.42] as const;
/** How high the mahout's hips sit on the elephant. */
const HOWDAH_HEIGHT = 0.88;
const ELEPHANT_STRIDE_HZ = 3;
const ELEPHANT_SWAY = 0.035;
const ELEPHANT_FALL_SECONDS = 0.5;

/** The elephant is a rigid model; it rocks while it walks and topples when it dies. */
class ElephantMotion {
  private pose: UnitPose = 'idle';
  private time = 0;

  constructor(private readonly body: Object3D) {}

  set(pose: UnitPose): void {
    if (this.pose === 'death') return;
    this.pose = pose;
    this.time = 0;
  }

  update(seconds: number): void {
    this.time += seconds;
    if (this.pose === 'walk') {
      const stride = Math.sin(this.time * ELEPHANT_STRIDE_HZ * Math.PI * 2);
      this.body.rotation.z = stride * ELEPHANT_SWAY;
      this.body.position.y = Math.abs(stride) * ELEPHANT_SWAY;
    } else if (this.pose === 'death') {
      this.body.rotation.z = (Math.PI / 2) * Math.min(1, this.time / ELEPHANT_FALL_SECONDS);
    } else {
      this.body.rotation.z *= 0.8;
      this.body.position.y *= 0.8;
    }
  }
}

/**
 * Units drawn as groups of figures made from the kit. Figures of one type and side are baked
 * once and cloned; each unit has its own material, so a hit can light it up alone.
 */
export function figureUnitModels(
  kit: UnitKit,
  fallback: UnitModelFactory = placeholderUnitModel
): UnitModelFactory {
  const baked = new Map<string, { figure: BakedFigure; horse?: BakedFigure }>();
  const banners = new Map<PlayerSlot, BufferGeometry>();
  const elephants = new Map<PlayerSlot, BufferGeometry>();
  let horseFigure: BakedFigure | undefined;
  let created = 0;

  const bakeFor = (type: UnitTypeDef, owner: PlayerSlot, recipe: FigureRecipe) => {
    const key = `${type.id}/${owner}`;
    const cached = baked.get(key);
    if (cached) return cached;
    const side = PLAYER_COLORS[owner];
    const filter = recipe.filter(side);
    const figure = bakeFigure(
      [
        {
          source: kit[recipe.body],
          filter: recipe.mount
            ? {
                ...filter,
                withoutMeshes: new RegExp(`Legs|Feet|${filter.withoutMeshes?.source ?? '^$'}`),
              }
            : filter,
        },
      ],
      recipe.gear(side)
    );
    if (recipe.mount === 'horse') horseFigure ??= bakeFigure([{ source: kit.horse }]);
    const entry = { figure, horse: recipe.mount === 'horse' ? horseFigure : undefined };
    baked.set(key, entry);
    return entry;
  };
  const geometryFor = (
    cache: Map<PlayerSlot, BufferGeometry>,
    owner: PlayerSlot,
    build: (side: number) => BufferGeometry
  ) => {
    const geometry = cache.get(owner) ?? build(PLAYER_COLORS[owner]);
    cache.set(owner, geometry);
    return geometry;
  };

  return (type, owner) => {
    const recipe = FIGURE_RECIPES[type.id];
    if (!recipe) return fallback(type, owner);
    const { figure, horse } = bakeFor(type, owner, recipe);
    const seed = ++created;

    const object = new Group();
    const material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
    });
    const standard = new Mesh(geometryFor(banners, owner, banner), material);
    standard.position.set(BANNER_SPOT[0], 0, BANNER_SPOT[1]);
    standard.castShadow = true;
    object.add(standard);

    const slots: Group[] = [];
    const actors: Actor[] = [];
    let beast: ElephantMotion | undefined;
    formation(recipe.count).forEach(([x, z], index) => {
      const slot = new Group();
      const jitter = scatter(seed * 7 + index);
      slot.position.set(
        x + (jitter - 0.5) * 0.06,
        0,
        z + (scatter(seed * 13 + index) - 0.5) * 0.06
      );
      slot.rotation.y = (jitter - 0.5) * 0.3;

      const person = instantiate(figure, material);
      person.scale.multiplyScalar(FIGURE_HEIGHT / figure.height);
      let seat: Object3D = slot;
      if (horse) {
        const mount = instantiate(horse, material);
        mount.scale.multiplyScalar(HORSE_LENGTH / horse.height / 1.3);
        slot.add(mount);
        actors.push({
          mixer: new AnimationMixer(mount),
          clips: HORSE_CLIPS,
          animations: horse.animations,
        });
        person.position.y = SADDLE_HEIGHT - FIGURE_HEIGHT * 0.5;
        person.position.z = -0.03;
      } else if (recipe.mount === 'elephant') {
        const body = new Mesh(geometryFor(elephants, owner, elephant), material);
        body.castShadow = true;
        slot.add(body);
        beast = new ElephantMotion(body);
        // The mahout rides with the elephant, so he sways and falls with it.
        seat = body;
        person.position.y = HOWDAH_HEIGHT - FIGURE_HEIGHT * 0.5;
        person.position.z = 0.05;
      }
      seat.add(person);
      actors.push({
        mixer: new AnimationMixer(person),
        clips: recipe.mount ? RIDER_CLIPS : HUMAN_CLIPS,
        animations: figure.animations,
      });
      slots.push(slot);
      object.add(slot);
    });
    actors.forEach((actor, index) => play(actor, 'idle', scatter(seed * 31 + index)));
    for (const actor of actors) actor.mixer.update(0);

    const model: UnitModel = {
      object,
      pose(pose) {
        const chosen = pose === 'attack' && recipe.ranged ? 'shoot' : pose;
        actors.forEach((actor, index) =>
          play(actor, chosen, chosen === 'idle' || chosen === 'walk' ? scatter(seed + index) : 0)
        );
        beast?.set(chosen);
      },
      update(seconds) {
        for (const actor of actors) actor.mixer.update(seconds);
        beast?.update(seconds);
      },
      setStrength(share) {
        const left = figuresLeft(slots.length, share);
        slots.forEach((slot, index) => (slot.visible = index < left));
      },
      dispose() {
        for (const actor of actors) actor.mixer.stopAllAction();
        material.dispose();
      },
    };
    return model;
  };
}
