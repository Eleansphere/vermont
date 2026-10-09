import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PCFSoftShadowMap,
  Scene,
  WebGLRenderer,
} from 'three';
import type { BattleDefs, BattleState, GameEvent, Hex, HexKey } from '@vermont/core';
import { hexEquals, mapHexes } from '@vermont/core';
import type { CameraView } from './camera';
import {
  azimuthOf,
  createIsometricCamera,
  frameView,
  panView,
  placeCamera,
  resizeIsometricCamera,
  rotateView,
  worldUnitsPerPixel,
  zoomView,
} from './camera';
import { attachControls } from './controls';
import { eventSteps } from './eventSteps';
import type { Highlights } from './highlights';
import { HighlightLayer } from './highlights';
import { boundsCenter, groundBounds } from './layout';
import { BACKGROUND_COLOR } from './palette';
import type { MapPick, ScreenPoint } from './picking';
import { Picker } from './picking';
import { createTerrainLayer } from './terrain';
import { Timeline } from './timeline';
import type { UnitModelFactory } from './unitModels';
import { UnitLayer } from './units';

const MAX_PIXEL_RATIO = 2;
const SKY_COLOR = 0xdfe9ff;
const GROUND_LIGHT_COLOR = 0x4a4436;
const AMBIENT_INTENSITY = 1.1;
const SUN_COLOR = 0xfff3dc;
const SUN_INTENSITY = 2.2;
/** Where the sun stands from the middle of the map, as a direction. */
const SUN_DIRECTION = { x: -0.55, y: 1, z: 0.35 } as const;
const SHADOW_MAP_SIZE = 2048;
/** World units the view moves on one press of a movement key, at zoom 1. */
const KEY_PAN_STEP = 2;
/** How fast the camera catches up with a turn: the share of the rest covered per second. */
const TURN_SPEED = 10;
/** Longest time one frame may move the animations forward, so a background tab does not jump. */
const MAX_FRAME_SECONDS = 0.1;

export interface BattleSceneOptions {
  /** The battle's definitions: the map to draw and what the units are. */
  readonly defs: BattleDefs;
  /** The player clicked a hex or a unit, or beside the map (`null`). */
  onPick?(pick: MapPick | null): void;
  /** The pointer moved to another hex, or off the map (`null`). */
  onHover?(pick: MapPick | null): void;
  /** Builds the units' models; placeholders when left out. */
  readonly unitModel?: UnitModelFactory;
}

/** Hexes the player looking at the scene sees; `null` when nothing lies in the fog of war. */
export type VisibleHexes = ReadonlySet<HexKey> | null;

export interface BattleScene {
  /**
   * Shows the state as it is, dropping any animation still playing. The scene draws every unit
   * of the state it is given, so with the fog on that is a player's view; hexes outside
   * `visible` are darkened.
   */
  sync(state: BattleState, visible?: VisibleHexes): void;
  /** Animates what happened and ends up showing `state`, the state after the events. */
  play(events: readonly GameEvent[], state: BattleState, visible?: VisibleHexes): void;
  setHighlights(highlights: Highlights): void;
  /** True while events are still being animated; clicks are ignored meanwhile. */
  readonly animating: boolean;
  /** Turns the camera by quarter turns. */
  rotate(steps: number): void;
  zoom(factor: number): void;
  /** Call when the canvas element changes size. */
  resize(): void;
  /** Stops rendering and frees GPU resources. */
  dispose(): void;
}

/** Draws a battle on the canvas in an isometric view and reports what the player points at. */
export function createBattleScene(
  canvas: HTMLCanvasElement,
  options: BattleSceneOptions
): BattleScene {
  const { defs } = options;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const hexes = mapHexes(defs.map);
  const bounds = groundBounds(hexes);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOR);
  const terrain = createTerrainLayer(defs);
  const units = new UnitLayer(defs, terrain.surfaceHeight, options.unitModel);
  const highlights = new HighlightLayer(hexes.length, terrain.surfaceHeight);
  const effects = new Group();
  const sun = createSun();
  scene.add(
    new HemisphereLight(SKY_COLOR, GROUND_LIGHT_COLOR, AMBIENT_INTENSITY),
    sun,
    sun.target,
    terrain.object,
    highlights.object,
    units.object,
    effects
  );

  const camera = createIsometricCamera(1);
  const picker = new Picker(terrain, units);
  const timeline = new Timeline();
  let view: CameraView = frameView(bounds, 1);
  let azimuth = azimuthOf(view.rotation);
  let framed = false;
  let hovered: Hex | null = null;

  function createSun(): DirectionalLight {
    const center = boundsCenter(bounds);
    const radius = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2;
    const light = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    light.target.position.set(center.x, 0, center.z);
    light.position.set(
      center.x + SUN_DIRECTION.x * radius * 2,
      SUN_DIRECTION.y * radius * 2,
      center.z + SUN_DIRECTION.z * radius * 2
    );
    light.castShadow = true;
    light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    light.shadow.camera.left = -radius;
    light.shadow.camera.right = radius;
    light.shadow.camera.top = radius;
    light.shadow.camera.bottom = -radius;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = radius * 6;
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.bias = -0.0005;
    return light;
  }

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    const aspect = clientWidth / clientHeight;
    resizeIsometricCamera(camera, aspect);
    // The whole map is framed once the real size of the canvas is known.
    if (!framed) {
      view = frameView(bounds, aspect, view.rotation);
      framed = true;
    }
  }

  function hover(point: ScreenPoint | null): void {
    const pick = point && picker.pick(point, camera);
    const target = pick?.hex ?? null;
    if (target === hovered || (target && hovered && hexEquals(target, hovered))) return;
    hovered = target;
    highlights.setHover(target);
    options.onHover?.(pick);
  }

  const detachControls = attachControls(canvas, {
    click(point) {
      if (!timeline.idle) return;
      options.onPick?.(picker.pick(point, camera));
    },
    hover,
    drag(deltaX, deltaY) {
      const scale = worldUnitsPerPixel(canvas.clientHeight || 1);
      view = panView(view, -deltaX * scale, deltaY * scale, bounds);
    },
    zoom(factor) {
      view = zoomView(view, factor);
    },
    rotate(steps) {
      view = rotateView(view, steps);
    },
    nudge(right, up) {
      view = panView(view, right * KEY_PAN_STEP, up * KEY_PAN_STEP, bounds);
    },
  });

  function show(state: BattleState, visible: VisibleHexes): void {
    units.sync(state);
    terrain.setFog(visible);
  }

  let lastTime: number | null = null;
  function frame(time: number): void {
    const seconds = Math.min(lastTime === null ? 0 : (time - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = time;
    timeline.update(seconds);
    azimuth += (azimuthOf(view.rotation) - azimuth) * Math.min(1, TURN_SPEED * seconds);
    placeCamera(camera, view, azimuth);
    renderer.render(scene, camera);
  }

  resize();
  placeCamera(camera, view, azimuth);
  renderer.setAnimationLoop(frame);

  return {
    sync(state, visible = null) {
      timeline.finish();
      show(state, visible);
    },
    play(events, state, visible = null) {
      const context = { units, state, effects };
      timeline.enqueue(
        ...events.flatMap((event) => eventSteps(event, context)),
        // Whatever the animation left slightly off is put right at its end, and what the
        // units came to see on the way shows up.
        { duration: 0, end: () => show(state, visible) }
      );
    },
    setHighlights: (marks) => highlights.set(marks),
    get animating() {
      return !timeline.idle;
    },
    rotate(steps) {
      view = rotateView(view, steps);
    },
    zoom(factor) {
      view = zoomView(view, factor);
    },
    resize,
    dispose() {
      renderer.setAnimationLoop(null);
      detachControls();
      timeline.finish();
      units.dispose();
      highlights.dispose();
      terrain.dispose();
      sun.dispose();
      renderer.dispose();
    },
  };
}
