import { OrthographicCamera } from 'three';
import type { GroundBounds, GroundPoint } from './layout';
import { boundsCenter, clampToBounds } from './layout';

/** Half of the world height visible at zoom 1. */
const VIEW_HALF_HEIGHT = 10;
const CAMERA_DISTANCE = 100;
/** The isometric tilt: about 35.264 degrees down from the horizon. */
const ELEVATION = Math.atan(1 / Math.SQRT2);
/**
 * The camera turns in quarter turns from the classic isometric diagonal. None of the four views
 * looks along a line of hexes, so units standing in a row never hide one another.
 */
export const ROTATION_STEP = Math.PI / 2;
const BASE_AZIMUTH = Math.PI / 4;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
/** Share of the view left free around a framed map. */
const FRAME_MARGIN = 0.08;

/** Where the camera looks from; everything the player can change about the view. */
export interface CameraView {
  /** The point on the ground in the middle of the screen. */
  readonly target: GroundPoint;
  readonly zoom: number;
  /** Turns around the vertical axis in steps of `ROTATION_STEP`; any integer. */
  readonly rotation: number;
}

export const DEFAULT_VIEW: CameraView = { target: { x: 0, z: 0 }, zoom: 1, rotation: 0 };

export function createIsometricCamera(aspect: number): OrthographicCamera {
  const camera = new OrthographicCamera();
  camera.near = 0.1;
  camera.far = CAMERA_DISTANCE * 10;
  resizeIsometricCamera(camera, aspect);
  placeCamera(camera, DEFAULT_VIEW);
  return camera;
}

export function resizeIsometricCamera(camera: OrthographicCamera, aspect: number): void {
  camera.top = VIEW_HALF_HEIGHT;
  camera.bottom = -VIEW_HALF_HEIGHT;
  camera.right = VIEW_HALF_HEIGHT * aspect;
  camera.left = -VIEW_HALF_HEIGHT * aspect;
  camera.updateProjectionMatrix();
}

export function azimuthOf(rotation: number): number {
  return BASE_AZIMUTH + rotation * ROTATION_STEP;
}

/**
 * Puts the camera where the view says. Zooming scales the frustum, never the distance.
 * `azimuth` overrides the angle of `view.rotation` while a turn is being animated.
 */
export function placeCamera(
  camera: OrthographicCamera,
  view: CameraView,
  azimuth: number = azimuthOf(view.rotation)
): void {
  const horizontal = CAMERA_DISTANCE * Math.cos(ELEVATION);
  camera.position.set(
    view.target.x + horizontal * Math.sin(azimuth),
    CAMERA_DISTANCE * Math.sin(ELEVATION),
    view.target.z + horizontal * Math.cos(azimuth)
  );
  camera.lookAt(view.target.x, 0, view.target.z);
  camera.zoom = view.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

export function zoomView(view: CameraView, factor: number): CameraView {
  return { ...view, zoom: clampZoom(view.zoom * factor) };
}

export function rotateView(view: CameraView, steps: number): CameraView {
  return { ...view, rotation: view.rotation + steps };
}

/**
 * Moves the view by a distance on the screen, in world units at zoom 1: `right` along the
 * screen's horizontal axis, `up` away from the viewer. The target stays inside `bounds`.
 */
export function panView(
  view: CameraView,
  right: number,
  up: number,
  bounds: GroundBounds
): CameraView {
  const azimuth = azimuthOf(view.rotation);
  // On the ground the screen's vertical axis is foreshortened by the camera tilt.
  const forward = up / Math.sin(ELEVATION);
  const target = {
    x: view.target.x + (right * Math.cos(azimuth) - forward * Math.sin(azimuth)) / view.zoom,
    z: view.target.z + (-right * Math.sin(azimuth) - forward * Math.cos(azimuth)) / view.zoom,
  };
  return { ...view, target: clampToBounds(target, bounds) };
}

/** The view that shows the whole of `bounds` in the middle of a screen with the given aspect. */
export function frameView(bounds: GroundBounds, aspect: number, rotation = 0): CameraView {
  const azimuth = azimuthOf(rotation);
  const center = boundsCenter(bounds);
  let halfWidth = 0;
  let halfHeight = 0;
  for (const x of [bounds.minX, bounds.maxX]) {
    for (const z of [bounds.minZ, bounds.maxZ]) {
      const dx = x - center.x;
      const dz = z - center.z;
      const right = dx * Math.cos(azimuth) - dz * Math.sin(azimuth);
      const forward = -dx * Math.sin(azimuth) - dz * Math.cos(azimuth);
      halfWidth = Math.max(halfWidth, Math.abs(right));
      halfHeight = Math.max(halfHeight, Math.abs(forward) * Math.sin(ELEVATION));
    }
  }
  const usable = VIEW_HALF_HEIGHT * (1 - FRAME_MARGIN);
  const zoom = Math.min(usable / (halfHeight || 1), (usable * aspect) / (halfWidth || 1));
  return { target: center, zoom: clampZoom(zoom), rotation };
}

/** World units one pixel covers at zoom 1 on a canvas of the given height. */
export function worldUnitsPerPixel(canvasHeight: number): number {
  return (2 * VIEW_HALF_HEIGHT) / canvasHeight;
}
