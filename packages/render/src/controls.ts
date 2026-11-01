import type { ScreenPoint } from './picking';
import { screenPoint } from './picking';

/** What kind of pointer pressed: a finger works without hovering, so it needs a preview first. */
export type PointerKind = 'mouse' | 'touch';

/** What the player's mouse, fingers and keyboard ask of the scene. */
export interface ControlHandlers {
  /** A click or a tap that was not a drag. */
  click(point: ScreenPoint, kind: PointerKind): void;
  /** The pointer moved over the canvas, or left it (`null`). */
  hover(point: ScreenPoint | null): void;
  /** The pointer dragged the map by this many pixels. */
  drag(deltaX: number, deltaY: number): void;
  /** Zoom by a factor: above 1 zooms in. */
  zoom(factor: number): void;
  /** Turn the camera by this many steps, one way or the other by the sign. */
  rotate(steps: number): void;
  /** Move the view by keyboard: one step right and/or away from the viewer. */
  nudge(right: number, up: number): void;
}

/** Pixels the pointer may move during a press and still count as a click. */
const DRAG_THRESHOLD = 5;
const WHEEL_ZOOM_SPEED = 0.0015;
const PRIMARY_BUTTON = 0;
/** How far two fingers must twist, in radians, to turn the camera one step. */
const TWIST_STEP = Math.PI / 5;

/** Where two fingers are: the point between them, how far apart and at what angle. */
export interface Pinch {
  readonly x: number;
  readonly y: number;
  readonly distance: number;
  readonly angle: number;
}

/** What a move of two fingers asks for: a pan, a zoom factor and a twist in radians. */
export interface PinchStep {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly zoom: number;
  readonly twist: number;
}

export function pinchOf(a: { x: number; y: number }, b: { x: number; y: number }): Pinch {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    angle: Math.atan2(b.y - a.y, b.x - a.x),
  };
}

/** How the two fingers moved from one pinch to the next. */
export function pinchStep(from: Pinch, to: Pinch): PinchStep {
  let twist = to.angle - from.angle;
  // The angle wraps round at ±π; the twist is always the short way.
  if (twist > Math.PI) twist -= 2 * Math.PI;
  if (twist < -Math.PI) twist += 2 * Math.PI;
  return {
    deltaX: to.x - from.x,
    deltaY: to.y - from.y,
    zoom: from.distance > 0 && to.distance > 0 ? to.distance / from.distance : 1,
    twist,
  };
}

/**
 * The camera turns in whole steps, so a twist is gathered until it is big enough for one.
 * Returns the steps to turn and what is left over.
 */
export function twistSteps(gathered: number): { steps: number; rest: number } {
  const steps = Math.trunc(gathered / TWIST_STEP);
  return { steps, rest: gathered - steps * TWIST_STEP };
}

/** Keys by physical position, so they work the same on every keyboard layout. */
const KEY_ACTIONS: Readonly<Record<string, (handlers: ControlHandlers) => void>> = {
  KeyQ: (handlers) => handlers.rotate(-1),
  KeyE: (handlers) => handlers.rotate(1),
  KeyW: (handlers) => handlers.nudge(0, 1),
  KeyS: (handlers) => handlers.nudge(0, -1),
  KeyA: (handlers) => handlers.nudge(-1, 0),
  KeyD: (handlers) => handlers.nudge(1, 0),
  ArrowUp: (handlers) => handlers.nudge(0, 1),
  ArrowDown: (handlers) => handlers.nudge(0, -1),
  ArrowLeft: (handlers) => handlers.nudge(-1, 0),
  ArrowRight: (handlers) => handlers.nudge(1, 0),
};

/** Listens to the canvas and the keyboard. Returns a function that stops listening. */
export function attachControls(canvas: HTMLCanvasElement, handlers: ControlHandlers): () => void {
  let press: { x: number; y: number; button: number; dragging: boolean } | null = null;
  /** Fingers and the mouse that are down on the canvas, by pointer id. */
  const down = new Map<number, { x: number; y: number }>();
  /** Set while two fingers are on the canvas; nothing they do counts as a tap. */
  let pinch: Pinch | null = null;
  let twist = 0;
  const pointOf = (event: PointerEvent) =>
    screenPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
  const kindOf = (event: PointerEvent): PointerKind =>
    event.pointerType === 'mouse' ? 'mouse' : 'touch';

  const twoFingers = (): Pinch | null => {
    const [a, b] = [...down.values()];
    return a && b ? pinchOf(a, b) : null;
  };

  const onPointerDown = (event: PointerEvent) => {
    down.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (down.size >= 2) {
      // A second finger turns the press into a pinch: no tap, no pan by the first finger.
      press = null;
      pinch = twoFingers();
      twist = 0;
      return;
    }
    press = { x: event.clientX, y: event.clientY, button: event.button, dragging: false };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (down.has(event.pointerId))
      down.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch) {
      const next = twoFingers();
      if (!next) return;
      const step = pinchStep(pinch, next);
      pinch = next;
      if (step.deltaX !== 0 || step.deltaY !== 0) handlers.drag(step.deltaX, step.deltaY);
      if (step.zoom !== 1) handlers.zoom(step.zoom);
      const turned = twistSteps(twist + step.twist);
      twist = turned.rest;
      if (turned.steps !== 0) handlers.rotate(-turned.steps);
      return;
    }
    if (!press) {
      if (event.pointerType === 'mouse') handlers.hover(pointOf(event));
      return;
    }
    const deltaX = event.clientX - press.x;
    const deltaY = event.clientY - press.y;
    if (!press.dragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    press.dragging = true;
    press.x = event.clientX;
    press.y = event.clientY;
    handlers.drag(deltaX, deltaY);
  };
  const release = (event: PointerEvent) => {
    down.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pinch && down.size < 2) pinch = null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const released = press;
    press = null;
    release(event);
    if (released && !released.dragging && released.button === PRIMARY_BUTTON) {
      handlers.click(pointOf(event), kindOf(event));
    }
  };
  const onPointerCancel = (event: PointerEvent) => {
    press = null;
    release(event);
  };
  const onPointerLeave = (event: PointerEvent) => {
    // A finger leaves the canvas every time it is lifted; what it tapped stays shown.
    if (!press && event.pointerType === 'mouse') handlers.hover(null);
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    handlers.zoom(Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED));
  };
  const onContextMenu = (event: Event) => event.preventDefault();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
    KEY_ACTIONS[event.code]?.(handlers);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKeyDown);
  };
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}
