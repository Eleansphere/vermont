import type { PlayerSlot, TerrainId } from '@vermont/core';

export const BACKGROUND_COLOR = 0x1b1f27;

/** Colour of each side's units and camp. */
export const PLAYER_COLORS: Readonly<Record<PlayerSlot, number>> = {
  0: 0xb8382f,
  1: 0x7a52b8,
};

export interface TerrainStyle {
  readonly color: number;
  /** Height of the hex's top above the ground plane, in world units. */
  readonly height: number;
}

export const TERRAIN_STYLES: Readonly<Record<TerrainId, TerrainStyle>> = {
  plain: { color: 0x86ad55, height: 0.3 },
  forest: { color: 0x6b9548, height: 0.3 },
  hill: { color: 0xa3ad5c, height: 0.8 },
  mountain: { color: 0x8d8780, height: 1.1 },
  marsh: { color: 0x66805c, height: 0.2 },
  ford: { color: 0x8dbdd0, height: 0.16 },
  road: { color: 0xbc9f6c, height: 0.3 },
  river: { color: 0x3f7fb8, height: 0.1 },
  sea: { color: 0x2c5c96, height: 0.1 },
  camp: { color: 0xb3945f, height: 0.3 },
};

export const TREE_COLOR = 0x2f6b3a;
export const PEAK_COLOR = 0xdad6d0;

export const HIGHLIGHT_COLORS = {
  reach: 0xffffff,
  path: 0xffd84a,
  targets: 0xff4a3d,
  selected: 0xffd84a,
  hover: 0xffffff,
} as const;
