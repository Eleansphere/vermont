import type { Material, Object3D } from 'three';
import {
  CanvasTexture,
  Color,
  Group,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type {
  Archetype,
  BattleDefs,
  BattleState,
  Hex,
  MoraleState,
  PlayerSlot,
  Unit,
} from '@vermont/core';
import { hexEquals, isFielded, unitTypeOf } from '@vermont/core';
import { HEX_SIZE, hexToWorld } from './layout';
import { PLAYER_COLORS } from './palette';
import type { UnitModel, UnitModelFactory, UnitPose } from './unitModels';
import { placeholderUnitModel } from './unitModels';

const HEALTH_BAR_WIDTH = 0.9;
const HEALTH_BAR_HEIGHT = 0.11;
/** Height of the health bar above the ground the unit stands on. */
const HEALTH_BAR_LIFT = 1.55;
/** The column a click on a unit hits: its figures, whatever shape they have. */
const PICK_RADIUS = 0.5;
const PICK_HEIGHT = 0.85;
const HEALTH_BAR_BACK_COLOR = 0x15171c;
const HEALTH_COLORS = { good: 0x6fd35a, hurt: 0xf0c13c, bad: 0xe5533d } as const;
/** The thin strip under the health bar that shows the unit's morale. */
const MORALE_BAR_HEIGHT = 0.05;
const MORALE_BAR_GAP = 0.03;
const MORALE_COLOR = 0x8fc3ff;
/** How thick the frame in the side's colour around the bars is. */
const BADGE_FRAME = 0.05;
/** How much a unit that cannot do anything more this turn is darkened, and its badge faded. */
const SPENT_SHADE = 0.5;
const SPENT_BADGE_OPACITY = 0.45;
/** The ring in the side's colour on the ground around each unit, so the sides tell apart. */
const OWNER_RING_INNER = 0.66;
const OWNER_RING_OUTER = 0.78;
const OWNER_RING_OPACITY = 0.85;
const OWNER_RING_LIFT = 0.025;
/** Turns a ring so that its corners match a pointy-top hex. */
const POINTY_TOP = Math.PI / 6;
/** A number that rises from a unit when it is hit, and fades away. */
const FLOAT_SECONDS = 1.2;
const FLOAT_RISE = 0.7;
const FLOAT_LIFT = HEALTH_BAR_LIFT + 0.25;
const FLOAT_HEIGHT = 0.42;
const HURT_BELOW = 0.66;
const BAD_BELOW = 0.33;
/** Space between the health bar and the morale marker beside it. */
const MARKER_GAP = 0.16;
const MARKER_SIZE = 0.26;
const MARKER_LOOKS: Readonly<
  Record<Exclude<MoraleState, 'steady'>, { color: string; sign: string }>
> = {
  shaken: { color: '#f0c13c', sign: '!' },
  routing: { color: '#e5533d', sign: '»' },
};
const FLASH_COLOR = new Color(0xffffff);
const NO_GLOW = new Color(0x000000);

/** A unit as drawn: the model, its health bar and where the renderer currently shows it. */
export interface UnitView {
  readonly unitId: string;
  readonly owner: PlayerSlot;
  readonly archetype: Archetype;
  /** Moves over the map; never turns, so the health bar stays level. */
  readonly object: Group;
  /** Turns to face where the unit goes or strikes. */
  readonly model: Object3D;
  /** What draws the unit: its figures and their clips. */
  readonly figures: UnitModel;
  /** The hex the unit is shown on. Follows the animation, not the state. */
  hex: Hex;
}

/** Draws the units on the field. It only shows what it is told; the rules live in the core. */
export class UnitLayer {
  readonly object = new Group();
  private readonly views = new Map<string, UnitView>();
  private readonly bars = new Map<string, UnitBadge>();
  private readonly spent = new Set<string>();
  private readonly floaters: Floater[] = [];
  private readonly ownerRing = new RingGeometry(
    HEX_SIZE * OWNER_RING_INNER,
    HEX_SIZE * OWNER_RING_OUTER,
    6,
    1,
    POINTY_TOP
  ).rotateX(-Math.PI / 2);
  private readonly ownerRingMaterials = ([0, 1] as const).map(
    (owner) =>
      new MeshBasicMaterial({
        color: PLAYER_COLORS[owner],
        opacity: OWNER_RING_OPACITY,
        transparent: true,
        depthWrite: false,
      })
  );
  private readonly markers = new Map<string, MoraleMarker>();
  private readonly pickables = new Map<string, Mesh>();
  // Never drawn, only hit: raycasting a column is cheap and does not depend on the figures.
  private readonly pickGeometry = new CylinderGeometry(
    PICK_RADIUS,
    PICK_RADIUS,
    PICK_HEIGHT,
    8
  ).translate(0, PICK_HEIGHT / 2, 0);
  private readonly pickMaterial = new MeshBasicMaterial({ visible: false });

  constructor(
    private readonly defs: BattleDefs,
    private readonly surfaceHeight: (target: Hex) => number,
    private readonly createModel: UnitModelFactory = placeholderUnitModel
  ) {}

  /** Makes the drawn units match the state exactly, without any animation. */
  sync(state: BattleState): void {
    for (const unitId of [...this.views.keys()]) {
      const unit = state.units[unitId];
      if (!unit || !isFielded(unit)) this.remove(unitId);
    }
    for (const unit of Object.values(state.units)) {
      if (!isFielded(unit)) continue;
      const view = this.views.get(unit.id) ?? this.add(unit, unit.pos);
      this.place(view, unit.pos);
      view.object.scale.setScalar(1);
      view.model.rotation.set(0, view.model.rotation.y, 0);
      this.setGlow(view, 0);
      this.setHealth(unit.id, unit.hp);
      this.setMorale(unit.id, unit.moraleState, unit.morale);
    }
  }

  /**
   * Darkens the units that cannot do anything more this turn and fades their badges; every
   * other unit is drawn as usual.
   */
  setSpent(unitIds: Iterable<string>): void {
    const spent = new Set(unitIds);
    for (const view of this.views.values()) {
      const isSpent = spent.has(view.unitId);
      if (isSpent === this.spent.has(view.unitId)) continue;
      if (isSpent) this.spent.add(view.unitId);
      else this.spent.delete(view.unitId);
      this.shade(view, isSpent ? SPENT_SHADE : 1);
      this.bars.get(view.unitId)?.setOpacity(isSpent ? SPENT_BADGE_OPACITY : 1);
      this.markers.get(view.unitId)?.setOpacity(isSpent ? SPENT_BADGE_OPACITY : 1);
    }
  }

  /** Whether the unit is drawn as spent for this turn. */
  isSpent(unitId: string): boolean {
    return this.spent.has(unitId);
  }

  view(unitId: string): UnitView | undefined {
    return this.views.get(unitId);
  }

  /** The unit shown on the hex. */
  viewAt(target: Hex): UnitView | undefined {
    for (const view of this.views.values()) {
      if (hexEquals(view.hex, target)) return view;
    }
    return undefined;
  }

  /** Puts a unit that is not drawn yet on the hex, facing the enemy's side of the map. */
  add(unit: Unit, target: Hex): UnitView {
    const type = unitTypeOf(this.defs, unit);
    const figures = this.createModel(type, unit.owner);
    const model = figures.object;
    model.rotation.y = unit.owner === 0 ? 0 : Math.PI;

    const object = new Group();
    object.userData.unitId = unit.id;
    object.add(model);
    const pickable = new Mesh(this.pickGeometry, this.pickMaterial);
    object.add(pickable);
    this.pickables.set(unit.id, pickable);
    const ring = new Mesh(this.ownerRing, this.ownerRingMaterials[unit.owner]);
    ring.position.y = OWNER_RING_LIFT;
    ring.renderOrder = 1;
    object.add(ring);
    const bar = new UnitBadge(type.hp, this.defs.rules.morale.max, PLAYER_COLORS[unit.owner]);
    bar.object.position.y = HEALTH_BAR_LIFT;
    object.add(bar.object);
    const marker = new MoraleMarker();
    marker.object.position.set(HEALTH_BAR_WIDTH / 2 + MARKER_GAP, HEALTH_BAR_LIFT, 0);
    object.add(marker.object);

    const view: UnitView = {
      unitId: unit.id,
      owner: unit.owner,
      archetype: type.archetype,
      object,
      model,
      figures,
      hex: target,
    };
    this.markers.set(unit.id, marker);
    marker.set(unit.moraleState);
    this.views.set(unit.id, view);
    this.bars.set(unit.id, bar);
    this.object.add(object);
    this.place(view, target);
    bar.set(unit.hp);
    bar.setMorale(unit.morale);
    return view;
  }

  remove(unitId: string): void {
    const view = this.views.get(unitId);
    if (!view) return;
    this.object.remove(view.object);
    view.figures.dispose();
    this.bars.get(unitId)?.dispose();
    this.markers.get(unitId)?.dispose();
    this.views.delete(unitId);
    this.bars.delete(unitId);
    this.markers.delete(unitId);
    this.pickables.delete(unitId);
    this.spent.delete(unitId);
  }

  /** Moves the figures' clips and the rising numbers forward; called every frame. */
  update(seconds: number): void {
    for (const view of this.views.values()) view.figures.update?.(seconds);
    for (const floater of [...this.floaters]) {
      floater.age += seconds;
      const progress = Math.min(1, floater.age / FLOAT_SECONDS);
      floater.sprite.position.y = floater.startY + FLOAT_RISE * progress;
      floater.sprite.material.opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
      if (progress >= 1) this.dropFloater(floater);
    }
  }

  /**
   * Lets a short text such as the damage taken rise from the unit and fade. It lives on its
   * own clock, so it never holds up the next step of an animation.
   */
  float(unitId: string, text: string, color: string): void {
    const view = this.views.get(unitId);
    const texture = view && textTexture(text, color);
    if (!view || !texture) return;
    const material = new SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new Sprite(material);
    const aspect = texture.image.width / texture.image.height;
    sprite.scale.set(FLOAT_HEIGHT * aspect, FLOAT_HEIGHT, 1);
    sprite.renderOrder = 13;
    const startY = view.object.position.y + FLOAT_LIFT;
    sprite.position.set(view.object.position.x, startY, view.object.position.z);
    this.object.add(sprite);
    this.floaters.push({ sprite, age: 0, startY });
  }

  /** How many rising numbers are on the screen. */
  get floating(): number {
    return this.floaters.length;
  }

  private dropFloater(floater: Floater): void {
    this.object.remove(floater.sprite);
    floater.sprite.material.map?.dispose();
    floater.sprite.material.dispose();
    this.floaters.splice(this.floaters.indexOf(floater), 1);
  }

  /** Sets what the unit's figures are doing. */
  pose(view: UnitView, pose: UnitPose): void {
    view.figures.pose?.(pose);
  }

  /** Whether the unit is drawn with clips; such units fall with their own animation. */
  animated(view: UnitView): boolean {
    return view.figures.pose !== undefined;
  }

  /** Shows the unit's morale state, and its morale when it is known. */
  setMorale(unitId: string, state: MoraleState, morale?: number): void {
    this.markers.get(unitId)?.set(state);
    if (morale !== undefined) this.bars.get(unitId)?.setMorale(morale);
  }

  /** Where a unit stands on the hex, in world coordinates. */
  standPoint(target: Hex): Vector3 {
    const { x, z } = hexToWorld(target);
    return new Vector3(x, this.surfaceHeight(target), z);
  }

  place(view: UnitView, target: Hex): void {
    view.hex = target;
    view.object.position.copy(this.standPoint(target));
  }

  /** Turns the model towards a point on the map. */
  face(view: UnitView, point: Vector3): void {
    const dx = point.x - view.object.position.x;
    const dz = point.z - view.object.position.z;
    if (dx !== 0 || dz !== 0) view.model.rotation.y = Math.atan2(dx, dz);
  }

  setHealth(unitId: string, hp: number): void {
    const bar = this.bars.get(unitId);
    if (!bar) return;
    bar.set(hp);
    this.views.get(unitId)?.figures.setStrength?.(bar.share(hp));
  }

  /** Multiplies the colours of the model's materials; 1 draws the unit as it was made. */
  private shade(view: UnitView, factor: number): void {
    view.model.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      for (const material of materialsOf(part)) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        const base = (material.userData.baseColor ??= material.color.clone()) as Color;
        material.color.copy(base).multiplyScalar(factor);
      }
    });
  }

  /** Lights the model up, 0 to 1; used to show a hit. */
  setGlow(view: UnitView, strength: number): void {
    view.model.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      for (const material of materialsOf(part)) {
        if (material instanceof MeshStandardMaterial) {
          material.emissive.lerpColors(NO_GLOW, FLASH_COLOR, strength);
        }
      }
    });
  }

  /** The objects a click can hit; `unitIdOf` tells which unit a hit part belongs to. */
  get pickTargets(): Object3D[] {
    return [...this.pickables.values()];
  }

  unitIdOf(part: Object3D): string | undefined {
    for (let current: Object3D | null = part; current; current = current.parent) {
      const unitId: unknown = current.userData.unitId;
      if (typeof unitId === 'string') return unitId;
    }
    return undefined;
  }

  dispose(): void {
    for (const unitId of [...this.views.keys()]) this.remove(unitId);
    for (const floater of [...this.floaters]) this.dropFloater(floater);
    this.pickGeometry.dispose();
    this.pickMaterial.dispose();
    this.ownerRing.dispose();
    for (const material of this.ownerRingMaterials) material.dispose();
  }
}

interface Floater {
  readonly sprite: Sprite;
  age: number;
  readonly startY: number;
}

/** Bold text with a dark edge, drawn on a canvas; `null` where there is no canvas. */
function textTexture(text: string, color: string): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const height = 64;
  const font = 'bold 48px system-ui, sans-serif';
  context.font = font;
  canvas.width = Math.ceil(context.measureText(text).width) + 16;
  canvas.height = height;
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = '#15171c';
  context.strokeText(text, canvas.width / 2, height / 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, height / 2);
  return new CanvasTexture(canvas);
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * The bars above the unit that always face the screen: health, and morale in a thin strip
 * under it, both framed in the colour of the unit's side.
 */
class UnitBadge {
  readonly object = new Group();
  private readonly fill: Sprite;
  private readonly moraleFill: Sprite;
  private readonly materials: SpriteMaterial[];

  constructor(
    private readonly maxHp: number,
    private readonly maxMorale: number,
    sideColor: number
  ) {
    const frameMaterial = new SpriteMaterial({ color: sideColor, depthTest: false });
    const backMaterial = new SpriteMaterial({ color: HEALTH_BAR_BACK_COLOR, depthTest: false });
    const fillMaterial = new SpriteMaterial({ color: HEALTH_COLORS.good, depthTest: false });
    const moraleMaterial = new SpriteMaterial({ color: MORALE_COLOR, depthTest: false });
    this.materials = [frameMaterial, backMaterial, fillMaterial, moraleMaterial];

    // The health bar sits at the badge's origin, the morale strip under it.
    const moraleY = -(HEALTH_BAR_HEIGHT + MORALE_BAR_HEIGHT) / 2 - MORALE_BAR_GAP;
    const innerHeight = HEALTH_BAR_HEIGHT + MORALE_BAR_GAP + MORALE_BAR_HEIGHT;
    const innerY = (HEALTH_BAR_HEIGHT / 2 + moraleY - MORALE_BAR_HEIGHT / 2) / 2;

    const frame = new Sprite(frameMaterial);
    frame.scale.set(HEALTH_BAR_WIDTH + 2 * BADGE_FRAME, innerHeight + 2 * BADGE_FRAME, 1);
    frame.position.y = innerY;
    frame.renderOrder = 9;
    const back = new Sprite(backMaterial);
    back.scale.set(HEALTH_BAR_WIDTH + 0.02, innerHeight + 0.02, 1);
    back.position.y = innerY;
    back.renderOrder = 10;
    this.fill = new Sprite(fillMaterial);
    this.fill.renderOrder = 11;
    this.moraleFill = new Sprite(moraleMaterial);
    this.moraleFill.position.y = moraleY;
    this.moraleFill.renderOrder = 11;
    this.object.add(frame, back, this.fill, this.moraleFill);
  }

  /** How much of the unit is left, 0 to 1. */
  share(hp: number): number {
    return Math.min(Math.max(hp / this.maxHp, 0), 1);
  }

  set(hp: number): void {
    const share = this.share(hp);
    stretch(this.fill, share, HEALTH_BAR_HEIGHT);
    if (share === 0) return;
    const color =
      share < BAD_BELOW
        ? HEALTH_COLORS.bad
        : share < HURT_BELOW
          ? HEALTH_COLORS.hurt
          : HEALTH_COLORS.good;
    this.fill.material.color.set(color);
  }

  setMorale(morale: number): void {
    stretch(this.moraleFill, Math.min(Math.max(morale / this.maxMorale, 0), 1), MORALE_BAR_HEIGHT);
  }

  setOpacity(opacity: number): void {
    for (const material of this.materials) {
      material.opacity = opacity;
      material.transparent = opacity < 1;
    }
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
  }
}

/** Fills `share` of a bar, anchored to its left end whichever way the camera looks. */
function stretch(bar: Sprite, share: number, height: number): void {
  bar.visible = share > 0;
  if (share === 0) return;
  bar.scale.set(HEALTH_BAR_WIDTH * share, height, 1);
  bar.center.set(1 / (2 * share), 0.5);
}

/** A round sign beside the health bar: yellow when the unit is shaken, red when it routs. */
class MoraleMarker {
  readonly object: Sprite;
  private readonly textures = new Map<MoraleState, CanvasTexture>();

  constructor() {
    this.object = new Sprite(new SpriteMaterial({ depthTest: false }));
    this.object.scale.set(MARKER_SIZE, MARKER_SIZE, 1);
    this.object.renderOrder = 12;
    this.object.visible = false;
  }

  setOpacity(opacity: number): void {
    this.object.material.opacity = opacity;
    this.object.material.transparent = true;
  }

  set(state: MoraleState): void {
    this.object.visible = state !== 'steady';
    if (state === 'steady') return;
    this.object.material.map = this.texture(state);
    this.object.material.needsUpdate = true;
  }

  private texture(state: Exclude<MoraleState, 'steady'>): CanvasTexture | null {
    const cached = this.textures.get(state);
    if (cached) return cached;
    if (typeof document === 'undefined') return null;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const look = MARKER_LOOKS[state];
    context.fillStyle = '#15171c';
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = look.color;
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#15171c';
    context.font = 'bold 44px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(look.sign, size / 2, size / 2 + 2);
    const texture = new CanvasTexture(canvas);
    this.textures.set(state, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.textures.values()) texture.dispose();
    this.object.material.dispose();
  }
}
