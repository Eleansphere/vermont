import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import type { Hex, HexKey } from '@vermont/core';
import { hexKey, hexNeighbors } from '@vermont/core';
import { HEX_SIZE, hexToWorld } from './layout';

/** How far above the hex's top the line floats, so it never fights the terrain for depth. */
const LIFT = 0.03;
/** Width of the line, and how far inside the hexes it is drawn. */
const OUTLINE_WIDTH = 0.07;

/**
 * A line around a group of hexes: every side of a hex whose neighbour is not in the group.
 * Each side is a thin strip lying just inside its hex, at the height of that hex.
 */
export class HexOutline {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;

  constructor(
    color: number,
    opacity: number,
    order: number,
    private readonly surfaceHeight: (target: Hex) => number
  ) {
    const material = new MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.mesh = new Mesh(new BufferGeometry(), material);
    this.mesh.renderOrder = order;
    this.mesh.frustumCulled = false;
  }

  /** How many sides the line runs along. */
  sides = 0;

  /**
   * Draws the line around `hexes`. With `against`, only the sides facing one of those hexes,
   * so a line between two parts of the map does not also run along its edge.
   */
  show(hexes: readonly Hex[], against?: ReadonlySet<HexKey>): void {
    const inside = new Set(hexes.map(hexKey));
    const positions: number[] = [];
    const half = HEX_SIZE / 2;
    for (const target of hexes) {
      const center = hexToWorld(target);
      const y = this.surfaceHeight(target) + LIFT;
      for (const neighbor of hexNeighbors(target)) {
        const key = hexKey(neighbor);
        if (inside.has(key) || (against && !against.has(key))) continue;
        const next = hexToWorld(neighbor);
        const length = Math.hypot(next.x - center.x, next.z - center.z);
        // Towards the neighbour, and along the side the two hexes share.
        const dx = (next.x - center.x) / length;
        const dz = (next.z - center.z) / length;
        const sideX = -dz * half;
        const sideZ = dx * half;
        const outerX = (center.x + next.x) / 2;
        const outerZ = (center.z + next.z) / 2;
        const innerX = outerX - dx * OUTLINE_WIDTH;
        const innerZ = outerZ - dz * OUTLINE_WIDTH;
        const a = [outerX - sideX, y, outerZ - sideZ];
        const b = [outerX + sideX, y, outerZ + sideZ];
        // The inner edge is a little shorter, so the strips meet at the hex's corners.
        const shorten = OUTLINE_WIDTH / Math.sqrt(3) / half;
        const c = [innerX + sideX * (1 - shorten), y, innerZ + sideZ * (1 - shorten)];
        const d = [innerX - sideX * (1 - shorten), y, innerZ - sideZ * (1 - shorten)];
        positions.push(...a, ...c, ...b, ...a, ...d, ...c);
      }
    }
    this.sides = positions.length / 18;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
