import type { Material, Object3D } from 'three';
import { Color, Group, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial, Vector3 } from 'three';
import type { BattleDefs, BattleState, Hex, PlayerSlot, Unit } from '@vermont/core';
import { hexEquals, isFielded, unitTypeOf } from '@vermont/core';
import { hexToWorld } from './layout';
import type { UnitModelFactory } from './unitModels';
import { placeholderUnitModel } from './unitModels';

const HEALTH_BAR_WIDTH = 0.9;
const HEALTH_BAR_HEIGHT = 0.11;
/** Height of the health bar above the ground the unit stands on. */
const HEALTH_BAR_LIFT = 1.55;
const HEALTH_BAR_BACK_COLOR = 0x15171c;
const HEALTH_COLORS = { good: 0x6fd35a, hurt: 0xf0c13c, bad: 0xe5533d } as const;
const HURT_BELOW = 0.66;
const BAD_BELOW = 0.33;
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
  /** The hex the unit is shown on. Follows the animation, not the state. */
  hex: Hex;
}

/** Draws the units on the field. It only shows what it is told; the rules live in the core. */
export class UnitLayer {
  readonly object = new Group();
  private readonly views = new Map<string, UnitView>();
  private readonly bars = new Map<string, HealthBar>();

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
    const model = this.createModel(type, unit.owner);
    model.rotation.y = unit.owner === 0 ? 0 : Math.PI;

    const object = new Group();
    object.userData.unitId = unit.id;
    object.add(model);
    const bar = new HealthBar(type.hp);
    bar.object.position.y = HEALTH_BAR_LIFT;
    object.add(bar.object);

    const view: UnitView = { unitId: unit.id, owner: unit.owner, object, model, hex: target };
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
    view.model.traverse((part) => {
      if (!(part instanceof Mesh)) return;
      part.geometry.dispose();
      for (const material of materialsOf(part)) material.dispose();
    });
    this.bars.get(unitId)?.dispose();
    this.views.delete(unitId);
    this.bars.delete(unitId);
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
    this.bars.get(unitId)?.set(hp);
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
    return [...this.views.values()].map((view) => view.model);
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

  set(hp: number): void {
    const share = Math.min(Math.max(hp / this.maxHp, 0), 1);
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
