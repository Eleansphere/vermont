import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { MoraleState, PlayerSlot } from '@vermont/core';
import type { UnitIcon } from './icons';
import { ICON_STROKE, UNIT_ICONS } from './icons';
import { PLAYER_COLORS } from './palette';

/** Size of a plate on the screen in CSS pixels; it stays the same at every zoom. */
export const PLATE_WIDTH = 56;
export const PLATE_HEIGHT = 22;
/** Room around the plate for the ring that marks the selected unit or a target. */
const PLATE_MARGIN = 3;
/** Canvas pixels per CSS pixel, so the plate stays sharp on screens with dense pixels. */
const PLATE_RESOLUTION = 3;
const ICON_BOX = PLATE_HEIGHT;
const CORNER = 4;
const BODY_COLOR = 'rgba(24, 27, 34, 0.92)';
const SPENT_ICON_COLOR = '#59606c';
const TEXT_COLOR = '#f4efe2';
const HEALTH_TEXT_COLORS = { hurt: '#f0c13c', bad: '#ff6b57' } as const;
const HURT_BELOW = 0.66;
const BAD_BELOW = 0.33;
const MORALE_COLOR = '#8fc3ff';
const MORALE_BACK_COLOR = '#353c49';
const MARK_COLORS = { selected: '#ffd23f', target: '#ff3b30' } as const;
const MORALE_SIGNS: Readonly<
  Record<Exclude<MoraleState, 'steady'>, { color: string; sign: string }>
> = {
  shaken: { color: '#f0c13c', sign: '!' },
  routing: { color: '#e5533d', sign: '»' },
};
/** How much a plate of a unit that cannot do anything more this turn fades. */
const SPENT_OPACITY = 0.6;

/** What a plate says about its unit. */
export interface PlateLook {
  readonly owner: PlayerSlot;
  readonly icon: UnitIcon;
  readonly hp: number;
  readonly maxHp: number;
  readonly morale: number;
  readonly maxMorale: number;
  readonly moraleState: MoraleState;
  /** The unit cannot do anything more this turn. */
  readonly spent: boolean;
  /** Ringed as the selected unit or as a target of the selected one. */
  readonly mark: PlateMark;
}

export type PlateMark = 'selected' | 'target' | null;

/** The share of the unit's health left, 0 to 1. */
export function healthShare(look: Pick<PlateLook, 'hp' | 'maxHp'>): number {
  return Math.min(Math.max(look.hp / look.maxHp, 0), 1);
}

/**
 * The sign above a unit, the same size on the screen at every zoom: the icon of its kind in
 * the colour of its side, its health as a number, its morale as a strip and a sign when it
 * wavers. Without a canvas (in tests) it only keeps what it would show.
 */
export class UnitPlate {
  readonly object: Sprite;
  private shown: PlateLook;
  private drawnKey: string | null = null;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly texture: CanvasTexture | null;

  constructor(look: PlateLook) {
    this.shown = look;
    this.canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (this.canvas) {
      this.canvas.width = (PLATE_WIDTH + 2 * PLATE_MARGIN) * PLATE_RESOLUTION;
      this.canvas.height = (PLATE_HEIGHT + 2 * PLATE_MARGIN) * PLATE_RESOLUTION;
    }
    this.texture = this.canvas ? new CanvasTexture(this.canvas) : null;
    if (this.texture) this.texture.colorSpace = SRGBColorSpace;
    this.object = new Sprite(
      new SpriteMaterial({ map: this.texture, depthTest: false, transparent: true })
    );
    // The plate stands on its anchor, so it grows upwards, away from the figures.
    this.object.center.set(0.5, 0);
    this.object.renderOrder = 12;
    this.object.visible = this.texture !== null;
    this.draw();
  }

  get look(): PlateLook {
    return this.shown;
  }

  update(change: Partial<PlateLook>): void {
    this.shown = { ...this.shown, ...change };
    this.object.material.opacity = this.shown.spent ? SPENT_OPACITY : 1;
    this.draw();
  }

  /** Keeps the plate the same size on the screen; `worldPerPixel` is one CSS pixel in the world. */
  setPixelSize(worldPerPixel: number): void {
    this.object.scale.set(
      (PLATE_WIDTH + 2 * PLATE_MARGIN) * worldPerPixel,
      (PLATE_HEIGHT + 2 * PLATE_MARGIN) * worldPerPixel,
      1
    );
  }

  dispose(): void {
    this.texture?.dispose();
    this.object.material.dispose();
  }

  private draw(): void {
    const context = this.canvas?.getContext('2d');
    if (!context || !this.texture) return;
    const key = JSON.stringify(this.shown);
    if (key === this.drawnKey) return;
    this.drawnKey = key;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.setTransform(
      PLATE_RESOLUTION,
      0,
      0,
      PLATE_RESOLUTION,
      PLATE_MARGIN * PLATE_RESOLUTION,
      PLATE_MARGIN * PLATE_RESOLUTION
    );
    drawPlate(context, this.shown);
    this.texture.needsUpdate = true;
  }
}

function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Draws the plate with its top left corner at the origin, in CSS pixels. */
function drawPlate(context: CanvasRenderingContext2D, look: PlateLook): void {
  const side = cssColor(PLAYER_COLORS[look.owner]);

  if (look.mark) {
    context.strokeStyle = MARK_COLORS[look.mark];
    context.lineWidth = 2.5;
    context.beginPath();
    context.roundRect(-1.5, -1.5, PLATE_WIDTH + 3, PLATE_HEIGHT + 3, CORNER + 1.5);
    context.stroke();
  }

  context.fillStyle = BODY_COLOR;
  context.beginPath();
  context.roundRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT, CORNER);
  context.fill();

  context.fillStyle = look.spent ? SPENT_ICON_COLOR : side;
  context.beginPath();
  context.roundRect(0, 0, ICON_BOX, ICON_BOX, [CORNER, 0, 0, CORNER]);
  context.fill();
  drawIcon(context, look.icon);

  context.strokeStyle = look.spent ? SPENT_ICON_COLOR : side;
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(0.75, 0.75, PLATE_WIDTH - 1.5, PLATE_HEIGHT - 1.5, CORNER - 0.5);
  context.stroke();

  // The morale strip along the bottom of the body.
  const stripX = ICON_BOX + 3;
  const stripWidth = PLATE_WIDTH - ICON_BOX - 6;
  context.fillStyle = MORALE_BACK_COLOR;
  context.fillRect(stripX, PLATE_HEIGHT - 5, stripWidth, 2);
  const moraleShare = Math.min(Math.max(look.morale / look.maxMorale, 0), 1);
  context.fillStyle = MORALE_COLOR;
  context.fillRect(stripX, PLATE_HEIGHT - 5, stripWidth * moraleShare, 2);

  const wavering = look.moraleState === 'steady' ? null : MORALE_SIGNS[look.moraleState];
  const bodyWidth = PLATE_WIDTH - ICON_BOX;
  const numberX = ICON_BOX + (wavering ? bodyWidth / 2 - 6 : bodyWidth / 2);
  const share = healthShare(look);
  context.fillStyle =
    share < BAD_BELOW
      ? HEALTH_TEXT_COLORS.bad
      : share < HURT_BELOW
        ? HEALTH_TEXT_COLORS.hurt
        : TEXT_COLOR;
  context.font = 'bold 14px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(Math.ceil(look.hp)), numberX, PLATE_HEIGHT / 2 - 1.5);

  if (wavering) {
    const x = PLATE_WIDTH - 9;
    const y = PLATE_HEIGHT / 2 - 1.5;
    context.fillStyle = wavering.color;
    context.beginPath();
    context.arc(x, y, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#15171c';
    context.font = 'bold 10px system-ui, sans-serif';
    context.fillText(wavering.sign, x, y + 0.5);
  }
}

/** The icon in the coloured box at the left of the plate, with pips under it when it has any. */
function drawIcon(context: CanvasRenderingContext2D, icon: UnitIcon): void {
  const size = icon.pips > 0 ? 14 : 16;
  const top = icon.pips > 0 ? 2 : (ICON_BOX - size) / 2;
  context.save();
  context.translate((ICON_BOX - size) / 2, top);
  context.scale(size / 24, size / 24);
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#ffffff';
  context.lineWidth = ICON_STROKE;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const path of UNIT_ICONS[icon.archetype]) {
    const shape = new Path2D(path.d);
    if (path.fill) context.fill(shape);
    else context.stroke(shape);
  }
  context.restore();

  context.fillStyle = '#ffffff';
  const gap = 4;
  const startX = ICON_BOX / 2 - ((icon.pips - 1) * gap) / 2;
  for (let pip = 0; pip < icon.pips; pip++) {
    context.beginPath();
    context.arc(startX + pip * gap, ICON_BOX - 3.5, 1.4, 0, Math.PI * 2);
    context.fill();
  }
}

/** Size of a camp's flag on the screen in CSS pixels, and its height above the camp. */
const CAMP_SIZE = 28;
const CAMP_LIFT = 2.1;
const FLAG_ICON = 'M7 21V3 M7 4h11l-3 4.5 3 4.5H7';

/**
 * A round flag in the side's colour high over its camp, the same size at every zoom, so the
 * goal of the battle shows from anywhere on the map.
 */
export class CampMarker {
  readonly object: Sprite;
  private readonly texture: CanvasTexture | null;

  constructor(owner: PlayerSlot) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      const size = CAMP_SIZE * PLATE_RESOLUTION;
      canvas.width = size;
      canvas.height = size;
      context.scale(PLATE_RESOLUTION, PLATE_RESOLUTION);
      const half = CAMP_SIZE / 2;
      context.fillStyle = cssColor(PLAYER_COLORS[owner]);
      context.strokeStyle = '#f4efe2';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(half, half, half - 1.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.translate(half - 9, half - 9);
      context.scale(18 / 24, 18 / 24);
      context.strokeStyle = '#ffffff';
      context.fillStyle = '#ffffff';
      context.lineWidth = ICON_STROKE;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      const flag = new Path2D(FLAG_ICON);
      context.stroke(flag);
      context.fill(new Path2D('M7 4h11l-3 4.5 3 4.5H7Z'));
    }
    this.texture = canvas && context ? new CanvasTexture(canvas) : null;
    if (this.texture) this.texture.colorSpace = SRGBColorSpace;
    this.object = new Sprite(
      new SpriteMaterial({ map: this.texture, depthTest: false, transparent: true })
    );
    this.object.center.set(0.5, 0);
    this.object.position.y = CAMP_LIFT;
    this.object.renderOrder = 11;
    this.object.visible = this.texture !== null;
  }

  setPixelSize(worldPerPixel: number): void {
    this.object.scale.set(CAMP_SIZE * worldPerPixel, CAMP_SIZE * worldPerPixel, 1);
  }

  dispose(): void {
    this.texture?.dispose();
    this.object.material.dispose();
  }
}
