import { OrthographicCamera } from 'three';

/** Half of the world height visible at zoom 1. */
const VIEW_HALF_HEIGHT = 10;
const CAMERA_DISTANCE = 100;
/** Classic isometric angles: 45 degrees around the vertical axis, about 35.264 degrees down. */
const AZIMUTH = Math.PI / 4;
const ELEVATION = Math.atan(1 / Math.SQRT2);

export function createIsometricCamera(aspect: number): OrthographicCamera {
  const camera = new OrthographicCamera();
  camera.near = 0.1;
  camera.far = CAMERA_DISTANCE * 10;
  const horizontal = CAMERA_DISTANCE * Math.cos(ELEVATION);
  camera.position.set(
    horizontal * Math.sin(AZIMUTH),
    CAMERA_DISTANCE * Math.sin(ELEVATION),
    horizontal * Math.cos(AZIMUTH)
  );
  camera.lookAt(0, 0, 0);
  resizeIsometricCamera(camera, aspect);
  return camera;
}

/** Zooming changes the frustum, never the camera position. */
export function resizeIsometricCamera(camera: OrthographicCamera, aspect: number): void {
  camera.top = VIEW_HALF_HEIGHT;
  camera.bottom = -VIEW_HALF_HEIGHT;
  camera.right = VIEW_HALF_HEIGHT * aspect;
  camera.left = -VIEW_HALF_HEIGHT * aspect;
  camera.updateProjectionMatrix();
}
