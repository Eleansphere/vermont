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
import { HEX_SIZE, HEX_WIDTH, hexToWorld } from './layout';
import { unitIcon } from './icons';
import { PLAYER_COLORS } from './palette';
import type { PlateLook } from './plate';
import { PLATE_HEIGHT, UnitPlate, healthShare } from './plate';
import type { UnitModel, UnitModelFactory, UnitPose } from './unitModels';
import { placeholderUnitModel } from './unitModels';

/** Height above the ground the unit stands on where its plate begins. */
const PLATE_LIFT = 1.25;
/** The column a click on a unit hits: its figures, whatever shape they have. */
const PICK_RADIUS = 0.5;
const PICK_HEIGHT = 0.85;
/** How much a unit that cannot do anything more this turn is darkened. */
const SPENT_SHADE = 0.5;
/** The ring in the side's colour on the ground around each unit, so the sides tell apart. */
const OWNER_RING_INNER = 0.66;
const OWNER_RING_OUTER = 0.78;
const OWNER_RING_OPACITY = 0.85;
const OWNER_RING_LIFT = 0.025;
/** Turns a ring so that its corners match a pointy-top hex. */
const POINTY_TOP = Math.PI / 6;
/** A number that rises from above a unit's plate when it is hit, and fades away; in CSS pixels. */
const FLOAT_SECONDS = 1.2;
const FLOAT_RISE = 26;
const FLOAT_HEIGHT = 22;
const FLOAT_GAP = 4;
/** How much shorter a height looks on the screen than across it, seen from the camera's tilt. */
const UPRIGHT_SHRINK = Math.sqrt(2 / 3);
/** One CSS pixel in the world until the scene says otherwise: a 900 pixel tall canvas at zoom 1. */
const DEFAULT_WORLD_PER_PIXEL = 20 / 900;
/**
 * Zoomed out so far that a hex is narrower than this on the screen, in CSS pixels, the plates
 * shrink with the map, down to the smallest share, so they do not pile up into one heap.
 */
const PLATES_SHRINK_BELOW = 64;
const SMALLEST_PLATE = 0.5;
const FLASH_COLOR = new Color(0xffffff);
const NO_GLOW = new Color(0x000000);

/** A unit as drawn: the model, its plate and where the renderer currently shows it. */
export interface UnitView {
  readonly unitId: string;
  readonly owner: PlayerSlot;
  readonly archetype: Archetype;
  /** Moves over the map; never turns, so the plate stays level. */
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
  private readonly plates = new Map<string, UnitPlate>();
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
  /** One CSS pixel in the world, for what keeps its size on the screen at every zoom. */
  private worldPerPixel = DEFAULT_WORLD_PER_PIXEL;
  /** The same for the plates, which shrink when the map is zoomed far out. */
  private plateWorldPerPixel = DEFAULT_WORLD_PER_PIXEL;
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
   * Darkens the units that cannot do anything more this turn and greys their plates; every
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
      this.plates.get(view.unitId)?.update({ spent: isSpent });
    }
  }

  /** Rings the plate of the selected unit and of the units it can attack. */
  setMarks(selectedId: string | null, targetIds: Iterable<string>): void {
    const targets = new Set(targetIds);
    for (const [unitId, plate] of this.plates) {
      const mark = unitId === selectedId ? 'selected' : targets.has(unitId) ? 'target' : null;
      if (plate.look.mark !== mark) plate.update({ mark });
    }
  }

  /** What the unit's plate shows. */
  plateLook(unitId: string): PlateLook | undefined {
    return this.plates.get(unitId)?.look;
  }

  /**
   * Tells how big one CSS pixel is in the world at the current zoom, so the plates and the
   * rising numbers keep their size on the screen.
   */
  setPixelSize(worldPerPixel: number): void {
    this.worldPerPixel = worldPerPixel;
    const hexPixels = HEX_WIDTH / worldPerPixel;
    const share = Math.min(1, Math.max(SMALLEST_PLATE, hexPixels / PLATES_SHRINK_BELOW));
    this.plateWorldPerPixel = worldPerPixel * share;
    for (const plate of this.plates.values()) plate.setPixelSize(this.plateWorldPerPixel);
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
    const plate = new UnitPlate({
      owner: unit.owner,
      icon: unitIcon(this.defs.unitTypes, type),
      hp: unit.hp,
      maxHp: type.hp,
      morale: unit.morale,
      maxMorale: this.defs.rules.morale.max,
      moraleState: unit.moraleState,
      spent: false,
      mark: null,
    });
    plate.object.position.y = PLATE_LIFT;
    plate.setPixelSize(this.plateWorldPerPixel);
    object.add(plate.object);

    const view: UnitView = {
      unitId: unit.id,
      owner: unit.owner,
      archetype: type.archetype,
      object,
      model,
      figures,
      hex: target,
    };
    this.views.set(unit.id, view);
    this.plates.set(unit.id, plate);
    this.object.add(object);
    this.place(view, target);
    figures.setStrength?.(healthShare(plate.look));
    return view;
  }

  remove(unitId: string): void {
    const view = this.views.get(unitId);
    if (!view) return;
    this.object.remove(view.object);
    view.figures.dispose();
    this.plates.get(unitId)?.dispose();
    this.views.delete(unitId);
    this.plates.delete(unitId);
    this.pickables.delete(unitId);
    this.spent.delete(unitId);
  }

  /** Moves the figures' clips and the rising numbers forward; called every frame. */
  update(seconds: number): void {
    for (const view of this.views.values()) view.figures.update?.(seconds);
    for (const floater of [...this.floaters]) {
      floater.age += seconds;
      const progress = Math.min(1, floater.age / FLOAT_SECONDS);
      const aspect = floater.aspect;
      floater.sprite.scale.set(
        FLOAT_HEIGHT * aspect * this.worldPerPixel,
        FLOAT_HEIGHT * this.worldPerPixel,
        1
      );
      const above = PLATE_HEIGHT + FLOAT_GAP + FLOAT_RISE * progress;
      floater.sprite.position.y =
        floater.startY + PLATE_LIFT + (above * this.worldPerPixel) / UPRIGHT_SHRINK;
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
    sprite.center.set(0.5, 0);
    sprite.renderOrder = 13;
    const startY = view.object.position.y;
    sprite.position.set(view.object.position.x, startY, view.object.position.z);
    this.object.add(sprite);
    this.floaters.push({ sprite, age: 0, startY, aspect });
    this.update(0);
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
    this.plates
      .get(unitId)
      ?.update({ moraleState: state, ...(morale !== undefined && { morale }) });
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
    const plate = this.plates.get(unitId);
    if (!plate) return;
    plate.update({ hp });
    this.views.get(unitId)?.figures.setStrength?.(healthShare(plate.look));
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
  /** Height of the ground under the unit it rises from. */
  readonly startY: number;
  /** Width of the text over its height. */
  readonly aspect: number;
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
