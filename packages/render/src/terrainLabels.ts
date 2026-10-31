import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { BattleDefs, Hex, TerrainDef } from '@vermont/core';
import { mapHexes, terrainAt } from '@vermont/core';
import { hexToWorld } from './layout';

/** Height of a label on the screen in CSS pixels; it stays the same at every zoom. */
const LABEL_HEIGHT = 16;
const LABEL_PADDING = 5;
const LABEL_FONT = '600 11px system-ui, sans-serif';
/** Canvas pixels per CSS pixel, so the text stays sharp on screens with dense pixels. */
const LABEL_RESOLUTION = 3;
const LABEL_LIFT = 0.06;

/** What a label says about a terrain; `null` leaves its hexes without one. */
export type TerrainLabelText = (terrain: TerrainDef) => string | null;

interface LabelTexture {
  readonly texture: CanvasTexture | null;
  /** Width of the label in CSS pixels. */
  readonly width: number;
}

/**
 * The terrain written on every hex that is not plain ground, for the player who wants to read
 * the map rather than guess it from the models. Hidden until it is asked for. Each kind of
 * terrain draws its text once and its hexes share it. Without a canvas (in tests) the labels
 * are only counted.
 */
export class TerrainLabels {
  readonly object = new Group();
  private readonly sprites: Sprite[] = [];
  private readonly textures = new Map<string, LabelTexture>();

  constructor(defs: BattleDefs, surfaceHeight: (target: Hex) => number, text: TerrainLabelText) {
    for (const mapHex of mapHexes(defs.map)) {
      const terrain = terrainAt(defs.map, defs.terrains, mapHex);
      const words = terrain ? text(terrain) : null;
      if (!words) continue;
      const label = this.textureOf(words);
      const sprite = new Sprite(
        new SpriteMaterial({ map: label.texture, depthTest: false, transparent: true })
      );
      sprite.userData.width = label.width;
      const { x, z } = hexToWorld(mapHex);
      sprite.position.set(x, surfaceHeight(mapHex) + LABEL_LIFT, z);
      sprite.renderOrder = 9;
      this.sprites.push(sprite);
      this.object.add(sprite);
    }
    this.object.visible = false;
  }

  /** How many hexes have a label. */
  get count(): number {
    return this.sprites.length;
  }

  get shown(): boolean {
    return this.object.visible;
  }

  show(on: boolean): void {
    this.object.visible = on;
  }

  /** Keeps the labels the same size on the screen; `worldPerPixel` is one CSS pixel in the world. */
  setPixelSize(worldPerPixel: number): void {
    if (!this.object.visible) return;
    for (const sprite of this.sprites) {
      sprite.scale.set(
        (sprite.userData.width as number) * worldPerPixel,
        LABEL_HEIGHT * worldPerPixel,
        1
      );
    }
  }

  dispose(): void {
    for (const sprite of this.sprites) sprite.material.dispose();
    for (const { texture } of this.textures.values()) texture?.dispose();
  }

  private textureOf(words: string): LabelTexture {
    const known = this.textures.get(words);
    if (known) return known;
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    const context = canvas?.getContext('2d');
    let width = words.length * 7 + 2 * LABEL_PADDING;
    let texture: CanvasTexture | null = null;
    if (canvas && context) {
      context.font = LABEL_FONT;
      width = Math.ceil(context.measureText(words).width) + 2 * LABEL_PADDING;
      canvas.width = width * LABEL_RESOLUTION;
      canvas.height = LABEL_HEIGHT * LABEL_RESOLUTION;
      context.scale(LABEL_RESOLUTION, LABEL_RESOLUTION);
      context.fillStyle = 'rgba(20, 23, 29, 0.78)';
      context.beginPath();
      context.roundRect(0, 0, width, LABEL_HEIGHT, LABEL_HEIGHT / 2);
      context.fill();
      context.font = LABEL_FONT;
      context.fillStyle = '#f4efe2';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(words, width / 2, LABEL_HEIGHT / 2 + 0.5);
      texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
    }
    const label = { texture, width };
    this.textures.set(words, label);
    return label;
  }
}
