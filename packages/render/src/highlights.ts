import type { BufferGeometry } from 'three';
import {
  CircleGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import type { Hex } from '@vermont/core';
import { HEX_SIZE, hexToWorld } from './layout';
import { HIGHLIGHT_COLORS } from './palette';

/** What the player should see marked on the map. Anything left out is not marked. */
export interface Highlights {
  /** The hex of the selected unit. */
  readonly selected?: Hex | null;
  /** Hexes the selected unit can move to. */
  readonly reach?: readonly Hex[];
  /** The route the unit would take to the hex under the pointer. */
  readonly path?: readonly Hex[];
  /** Hexes of the units the selected unit can attack. */
  readonly targets?: readonly Hex[];
}

const HEX_CORNERS = 6;
/** Turns a ring or disc so that its corners match a pointy-top hex. */
const POINTY_TOP = Math.PI / 6;
/** How far above the hex's top a mark floats, so it never fights the terrain for depth. */
const LIFT = 0.03;

function disc(radius: number): BufferGeometry {
  return new CircleGeometry(HEX_SIZE * radius, HEX_CORNERS, POINTY_TOP).rotateX(-Math.PI / 2);
}

function ring(inner: number, outer: number): BufferGeometry {
  return new RingGeometry(HEX_SIZE * inner, HEX_SIZE * outer, HEX_CORNERS, 1, POINTY_TOP).rotateX(
    -Math.PI / 2
  );
}

/** One kind of mark, drawn on any number of hexes with a single draw call. */
class HexMarks {
  readonly mesh: InstancedMesh<BufferGeometry, MeshBasicMaterial>;
  private readonly matrix = new Matrix4();

  constructor(
    geometry: BufferGeometry,
    color: number,
    opacity: number,
    capacity: number,
    order: number,
    private readonly surfaceHeight: (target: Hex) => number
  ) {
    const material = new MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.renderOrder = order;
    // The marks move around, so a bounding volume computed once would cull them wrongly.
    this.mesh.frustumCulled = false;
  }

  show(hexes: readonly Hex[]): void {
    const shown = hexes.slice(0, this.mesh.instanceMatrix.count);
    shown.forEach((target, index) => {
      const { x, z } = hexToWorld(target);
      this.matrix.makeTranslation(x, this.surfaceHeight(target) + LIFT, z);
      this.mesh.setMatrixAt(index, this.matrix);
    });
    this.mesh.count = shown.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

/** The marks on the map: selection, reach, path, targets and the hex under the pointer. */
export class HighlightLayer {
  readonly object = new Group();
  private readonly reach: HexMarks;
  private readonly path: HexMarks;
  private readonly targets: HexMarks;
  private readonly selected: HexMarks;
  private readonly hover: HexMarks;

  /** `capacity` is the number of hexes on the map: no mark can be on more of them. */
  constructor(capacity: number, surfaceHeight: (target: Hex) => number) {
    const marks = (geometry: BufferGeometry, color: number, opacity: number, count = capacity) => {
      const order = this.object.children.length + 1;
      const hexMarks = new HexMarks(geometry, color, opacity, count, order, surfaceHeight);
      this.object.add(hexMarks.mesh);
      return hexMarks;
    };
    this.reach = marks(disc(0.86), HIGHLIGHT_COLORS.reach, 0.28);
    this.path = marks(disc(0.5), HIGHLIGHT_COLORS.path, 0.85);
    this.targets = marks(ring(0.62, 0.92), HIGHLIGHT_COLORS.targets, 0.9);
    this.selected = marks(ring(0.74, 0.92), HIGHLIGHT_COLORS.selected, 0.95, 1);
    this.hover = marks(ring(0.84, 0.94), HIGHLIGHT_COLORS.hover, 0.7, 1);
  }

  set(highlights: Highlights): void {
    this.reach.show(highlights.reach ?? []);
    this.path.show(highlights.path ?? []);
    this.targets.show(highlights.targets ?? []);
    this.selected.show(highlights.selected ? [highlights.selected] : []);
  }

  setHover(target: Hex | null): void {
    this.hover.show(target ? [target] : []);
  }

  dispose(): void {
    for (const marks of [this.reach, this.path, this.targets, this.selected, this.hover]) {
      marks.dispose();
    }
  }
}
