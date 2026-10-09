import type { Camera } from 'three';
import { InstancedMesh, Raycaster, Vector2 } from 'three';
import type { Hex } from '@vermont/core';
import type { TerrainLayer } from './terrain';
import type { UnitLayer } from './units';

/** What is under a point of the screen. */
export interface MapPick {
  readonly hex: Hex;
  /** Set when the point is on a unit or on the hex a unit stands on. */
  readonly unitId?: string;
}

/** A point of the screen in normalized device coordinates: both axes from -1 to 1, y up. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export function screenPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): ScreenPoint {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}

/**
 * Finds what the player points at. A unit's model wins over the ground behind it, so a tall
 * unit can be clicked anywhere on its body.
 */
export class Picker {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  constructor(
    private readonly terrain: TerrainLayer,
    private readonly units: UnitLayer
  ) {}

  pick(point: ScreenPoint, camera: Camera): MapPick | null {
    this.raycaster.setFromCamera(this.pointer.set(point.x, point.y), camera);
    const targets = [...this.units.pickTargets, ...this.terrain.pickTargets];
    for (const hit of this.raycaster.intersectObjects(targets, true)) {
      const unitId = this.units.unitIdOf(hit.object);
      const view = unitId === undefined ? undefined : this.units.view(unitId);
      if (view) return { hex: view.hex, unitId: view.unitId };

      if (hit.object instanceof InstancedMesh && hit.instanceId !== undefined) {
        const hex = this.terrain.hexOfInstance(hit.object, hit.instanceId);
        if (hex) return { hex, unitId: this.units.viewAt(hex)?.unitId };
      }
    }
    return null;
  }
}
