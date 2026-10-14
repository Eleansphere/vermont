import type { Material, Object3D } from 'three';
import {
  CanvasTexture,
  Color,
  Group,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import type { BattleDefs, BattleState, Hex, MoraleState, PlayerSlot, Unit } from '@vermont/core';
import { hexEquals, isFielded, unitTypeOf } from '@vermont/core';
import { hexToWorld } from './layout';
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
  private readonly bars = new Map<string, HealthBar>();
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
      this.setMorale(unit.id, unit.moraleState);
    }
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
    const bar = new HealthBar(type.hp);
    bar.object.position.y = HEALTH_BAR_LIFT;
    object.add(bar.object);
    const marker = new MoraleMarker();
    marker.object.position.set(HEALTH_BAR_WIDTH / 2 + MARKER_GAP, HEALTH_BAR_LIFT, 0);
    object.add(marker.object);

    const view: UnitView = {
      unitId: unit.id,
      owner: unit.owner,
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
  }

  /** Moves the figures' clips forward; called every frame. */
  update(seconds: number): void {
    for (const view of this.views.values()) view.figures.update?.(seconds);
  }

  /** Sets what the unit's figures are doing. */
  pose(view: UnitView, pose: UnitPose): void {
    view.figures.pose?.(pose);
  }

  /** Whether the unit is drawn with clips; such units fall with their own animation. */
  animated(view: UnitView): boolean {
    return view.figures.pose !== undefined;
  }

  setMorale(unitId: string, state: MoraleState): void {
    this.markers.get(unitId)?.set(state);
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
    this.pickGeometry.dispose();
    this.pickMaterial.dispose();
  }
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** A bar above the unit that always faces the screen. */
class HealthBar {
  readonly object = new Group();
  private readonly fill: Sprite;
  private readonly materials: SpriteMaterial[];

  constructor(private readonly maxHp: number) {
    const backMaterial = new SpriteMaterial({ color: HEALTH_BAR_BACK_COLOR, depthTest: false });
    const fillMaterial = new SpriteMaterial({ color: HEALTH_COLORS.good, depthTest: false });
    this.materials = [backMaterial, fillMaterial];

    const back = new Sprite(backMaterial);
    back.scale.set(HEALTH_BAR_WIDTH + 0.06, HEALTH_BAR_HEIGHT + 0.06, 1);
    back.renderOrder = 10;
    this.fill = new Sprite(fillMaterial);
    this.fill.renderOrder = 11;
    this.object.add(back, this.fill);
  }

  /** How much of the unit is left, 0 to 1. */
  share(hp: number): number {
    return Math.min(Math.max(hp / this.maxHp, 0), 1);
  }

  set(hp: number): void {
    const share = this.share(hp);
    this.fill.visible = share > 0;
    if (share === 0) return;

    this.fill.scale.set(HEALTH_BAR_WIDTH * share, HEALTH_BAR_HEIGHT, 1);
    // Anchors the shrinking fill to the left end of the bar, whichever way the camera looks.
    this.fill.center.set(1 / (2 * share), 0.5);
    const color =
      share < BAD_BELOW
        ? HEALTH_COLORS.bad
        : share < HURT_BELOW
          ? HEALTH_COLORS.hurt
          : HEALTH_COLORS.good;
    this.fill.material.color.set(color);
  }

  dispose(): void {
    for (const material of this.materials) material.dispose();
  }
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
