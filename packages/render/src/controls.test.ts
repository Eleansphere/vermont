import { describe, expect, it } from 'vitest';
import { pinchOf, pinchStep, twistSteps } from './controls';

describe('two-finger gestures', () => {
  it('finds the point between the fingers, their distance and angle', () => {
    expect(pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 })).toEqual({
      x: 50,
      y: 0,
      distance: 100,
      angle: 0,
    });
  });

  it('zooms in as the fingers spread and pans with the point between them', () => {
    const step = pinchStep(
      pinchOf({ x: 0, y: 0 }, { x: 100, y: 0 }),
      pinchOf({ x: -40, y: 10 }, { x: 160, y: 10 })
    );
    expect(step).toMatchObject({ deltaX: 10, deltaY: 10, zoom: 2 });
    expect(step.twist).toBeCloseTo(0);
  });

  it('takes the short way round when the angle wraps', () => {
    const from = pinchOf({ x: 0, y: 0 }, { x: -100, y: 1 });
    const to = pinchOf({ x: 0, y: 0 }, { x: -100, y: -1 });
    expect(Math.abs(pinchStep(from, to).twist)).toBeLessThan(0.05);
  });

  it('turns the camera only for a big enough twist, keeping the rest', () => {
    expect(twistSteps(0.3)).toEqual({ steps: 0, rest: 0.3 });
    const turned = twistSteps(-0.7);
    expect(turned.steps).toBe(-1);
    expect(turned.rest).toBeCloseTo(-0.7 + Math.PI / 5);
  });
});
