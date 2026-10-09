import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createIsometricCamera, resizeIsometricCamera } from './camera';

describe('isometric camera', () => {
  it('looks at the origin from equal distances on all three axes', () => {
    const camera = createIsometricCamera(1);

    expect(camera.position.x).toBeCloseTo(camera.position.y);
    expect(camera.position.y).toBeCloseTo(camera.position.z);

    const direction = camera.getWorldDirection(new Vector3());
    const toOrigin = camera.position.clone().negate().normalize();
    expect(direction.distanceTo(toOrigin)).toBeCloseTo(0);
  });

  it('widens the frustum with the aspect ratio and keeps its height', () => {
    const camera = createIsometricCamera(1);
    const height = camera.top - camera.bottom;

    resizeIsometricCamera(camera, 2);

    expect(camera.top - camera.bottom).toBeCloseTo(height);
    expect(camera.right - camera.left).toBeCloseTo(height * 2);
  });
});
