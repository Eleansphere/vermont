import type { Hex } from '@vermont/core';
import { hexRound } from '@vermont/core';

/** A point on the ground plane of the scene; the vertical axis is `y`. */
export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

export interface GroundBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Distance from the centre of a hex to its corners, in world units. */
export const HEX_SIZE = 1;

const SQRT_3 = Math.sqrt(3);
/** Distance between the centres of two neighbouring hexes in a row. */
export const HEX_WIDTH = SQRT_3 * HEX_SIZE;
/** Distance between two rows of hexes. */
const ROW_SPACING = 1.5 * HEX_SIZE;

/**
 * Centre of a pointy-top hex on the ground. `q` grows to the east (+x) and `r` to the south
 * (+z), as in the core.
 */
export function hexToWorld(target: Hex): GroundPoint {
  return {
    x: HEX_WIDTH * (target.q + target.r / 2),
    z: ROW_SPACING * target.r,
  };
}

/** The hex under a point on the ground; it need not be on the map. */
export function worldToHex(point: GroundPoint): Hex {
  const r = point.z / ROW_SPACING;
  const q = point.x / HEX_WIDTH - r / 2;
  return hexRound({ q, r });
}

/** The rectangle around the given hexes, whole hexes included. */
export function groundBounds(hexes: readonly Hex[]): GroundBounds {
  if (hexes.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const mapHex of hexes) {
    const { x, z } = hexToWorld(mapHex);
    minX = Math.min(minX, x - HEX_WIDTH / 2);
    maxX = Math.max(maxX, x + HEX_WIDTH / 2);
    minZ = Math.min(minZ, z - HEX_SIZE);
    maxZ = Math.max(maxZ, z + HEX_SIZE);
  }
  return { minX, maxX, minZ, maxZ };
}

export function boundsCenter(bounds: GroundBounds): GroundPoint {
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}

/** The nearest point inside the bounds. */
export function clampToBounds(point: GroundPoint, bounds: GroundBounds): GroundPoint {
  return {
    x: Math.min(Math.max(point.x, bounds.minX), bounds.maxX),
    z: Math.min(Math.max(point.z, bounds.minZ), bounds.maxZ),
  };
}
