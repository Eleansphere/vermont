import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { MAPS, mapHexes } from '@vermont/core';
import {
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  createIsometricCamera,
  frameView,
  panView,
  placeCamera,
  resizeIsometricCamera,
  rotateView,
  zoomView,
} from './camera';
import { groundBounds } from './layout';

const WIDE = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };

describe('isometric camera', () => {
  it('looks down at its target at the isometric angle', () => {
    const camera = createIsometricCamera(1);
    placeCamera(camera, { ...DEFAULT_VIEW, target: { x: 4, z: -3 } });

    const direction = camera.getWorldDirection(new Vector3());
    const toTarget = new Vector3(4, 0, -3).sub(camera.position).normalize();
    expect(direction.distanceTo(toTarget)).toBeCloseTo(0);
    expect(Math.asin(-direction.y)).toBeCloseTo(Math.atan(1 / Math.SQRT2));
  });

  it('widens the frustum with the aspect ratio and keeps its height', () => {
    const camera = createIsometricCamera(1);
    const height = camera.top - camera.bottom;

    resizeIsometricCamera(camera, 2);

    expect(camera.top - camera.bottom).toBeCloseTo(height);
    expect(camera.right - camera.left).toBeCloseTo(height * 2);
  });

  it('zooms by scaling the frustum, not by moving', () => {
    const camera = createIsometricCamera(1);
    const position = camera.position.clone();

    placeCamera(camera, zoomView(DEFAULT_VIEW, 2));

    expect(camera.zoom).toBe(2);
    expect(camera.position.distanceTo(position)).toBeCloseTo(0);
  });

  it('keeps the zoom within its limits', () => {
    expect(zoomView(DEFAULT_VIEW, 1000).zoom).toBe(MAX_ZOOM);
    expect(zoomView(DEFAULT_VIEW, 0.0001).zoom).toBe(MIN_ZOOM);
  });

  it('comes back to where it started after four turns', () => {
    const camera = createIsometricCamera(1);
    const start = camera.position.clone();

    placeCamera(camera, rotateView(DEFAULT_VIEW, 1));
    expect(camera.position.distanceTo(start)).toBeGreaterThan(1);
    expect(camera.position.y).toBeCloseTo(start.y);

    placeCamera(camera, rotateView(DEFAULT_VIEW, 4));
    expect(camera.position.distanceTo(start)).toBeCloseTo(0);
  });

  it.each([0, 1, 3])('pans along the axes of the screen after %i turns', (rotation) => {
    const camera = createIsometricCamera(1);
    const view = rotateView(DEFAULT_VIEW, rotation);
    placeCamera(camera, view);
    const onScreen = (x: number, z: number) => new Vector3(x, 0, z).project(camera);

    const right = panView(view, 3, 0, WIDE).target;
    expect(onScreen(right.x, right.z).x).toBeCloseTo(0.3);
    expect(onScreen(right.x, right.z).y).toBeCloseTo(0);

    // Three world units at zoom 1 are 3/10 of half the screen.
    const up = panView(view, 0, 3, WIDE).target;
    expect(onScreen(up.x, up.z).x).toBeCloseTo(0);
    expect(onScreen(up.x, up.z).y).toBeCloseTo(0.3);
  });

  it('does not pan off the map', () => {
    const bounds = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };

    const { target } = panView(DEFAULT_VIEW, 50, 50, bounds);

    expect(Math.abs(target.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(target.z)).toBeLessThanOrEqual(1);
  });

  it.each([
    [1, 0],
    [16 / 9, 0],
    [0.6, 2],
  ])('frames the whole map at aspect %f after %i turns', (aspect, rotation) => {
    const bounds = groundBounds(mapHexes(MAPS.trebia!));
    const camera = createIsometricCamera(aspect);

    placeCamera(camera, frameView(bounds, aspect, rotation));

    for (const x of [bounds.minX, bounds.maxX]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const corner = new Vector3(x, 0, z).project(camera);
        expect(Math.abs(corner.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(corner.y)).toBeLessThanOrEqual(1);
      }
    }
  });
});
