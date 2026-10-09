import type { ScreenPoint } from './picking';
import { screenPoint } from './picking';

/** What the player's mouse and keyboard ask of the scene. */
export interface ControlHandlers {
  /** A click that was not a drag. */
  click(point: ScreenPoint): void;
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
  const pointOf = (event: PointerEvent) =>
    screenPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());

  const onPointerDown = (event: PointerEvent) => {
    press = { x: event.clientX, y: event.clientY, button: event.button, dragging: false };
    canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!press) {
      handlers.hover(pointOf(event));
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
  const onPointerUp = (event: PointerEvent) => {
    const released = press;
    press = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (released && !released.dragging && released.button === PRIMARY_BUTTON) {
      handlers.click(pointOf(event));
    }
  };
  const onPointerCancel = () => {
    press = null;
  };
  const onPointerLeave = () => {
    if (!press) handlers.hover(null);
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
