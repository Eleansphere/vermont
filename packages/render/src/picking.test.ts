import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import type { Hex } from '@vermont/core';
import { fieldedUnits, mapHexes, rectangleHex, unitAt } from '@vermont/core';
import { createIsometricCamera, frameView, placeCamera } from './camera';
import { groundBounds, hexToWorld } from './layout';
import { Picker, screenPoint } from './picking';
import { createTerrainLayer } from './terrain';
import { deployedTrebia } from './testSupport';
import { UnitLayer } from './units';

describe('picking', () => {
  const { state, defs } = deployedTrebia();
  const terrain = createTerrainLayer(defs);
  const units = new UnitLayer(defs, terrain.surfaceHeight);
  units.sync(state);
  const world = new Group().add(terrain.object, units.object);
  world.updateMatrixWorld(true);

  const camera = createIsometricCamera(1.5);
  const picker = new Picker(terrain, units);
  const lookFrom = (rotation: number) =>
    placeCamera(camera, frameView(groundBounds(mapHexes(defs.map)), 1.5, rotation));
  /** Where the middle of the hex's top is on the screen. */
  const onScreen = (target: Hex) => {
    const { x, z } = hexToWorld(target);
    const point = new Vector3(x, terrain.surfaceHeight(target), z).project(camera);
    return { x: point.x, y: point.y };
  };

  it.each([0, 1, 3])('finds the hex under the pointer after %i turns of the camera', (rotation) => {
    lookFrom(rotation);

    for (const target of [rectangleHex(6, 5), rectangleHex(4, 3), rectangleHex(0, 5)]) {
      expect(unitAt(state, target)).toBeUndefined();
      expect(picker.pick(onScreen(target), camera)).toEqual({ hex: target, unitId: undefined });
    }
  });

  it('finds the unit standing on the hex', () => {
    lookFrom(0);

    for (const unit of fieldedUnits(state)) {
      expect(picker.pick(onScreen(unit.pos), camera)).toEqual({ hex: unit.pos, unitId: unit.id });
    }
  });

  it('finds nothing beside the map', () => {
    lookFrom(0);

    expect(picker.pick({ x: -0.99, y: 0.99 }, camera)).toBeNull();
  });

  it('turns a pointer position into screen coordinates', () => {
    const rect = { left: 100, top: 50, width: 800, height: 400 };

    expect(screenPoint(100, 50, rect)).toEqual({ x: -1, y: 1 });
    expect(screenPoint(500, 250, rect)).toEqual({ x: 0, y: -0 });
    expect(screenPoint(900, 450, rect)).toEqual({ x: 1, y: -1 });
  });
});
