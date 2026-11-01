import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PCFShadowMap,
  PCFSoftShadowMap,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type {
  Archetype,
  BattleDefs,
  BattleState,
  GameEvent,
  Hex,
  HexKey,
  PlayerSlot,
} from '@vermont/core';
import { PLAYER_SLOTS, hexEquals, mapHexes } from '@vermont/core';
import type { CameraView } from './camera';
import {
  azimuthOf,
  closeUpView,
  createIsometricCamera,
  frameView,
  glideView,
  panView,
  placeCamera,
  resizeIsometricCamera,
  rotateView,
  worldUnitsPerPixel,
  zoomView,
} from './camera';
import { attachControls } from './controls';
import type { PointerKind } from './controls';
import type { CueKind } from './eventSteps';
import { eventSteps } from './eventSteps';
import type { Highlights } from './highlights';
import { HighlightLayer } from './highlights';
import type { TerrainLabelText } from './terrainLabels';
import { TerrainLabels } from './terrainLabels';
import type { GroundPoint } from './layout';
import { boundsCenter, clampToBounds, groundBounds, hexToWorld } from './layout';
import { BACKGROUND_COLOR } from './palette';
import type { MapPick, ScreenPoint } from './picking';
import { Picker } from './picking';
import { CampMarker } from './plate';
import { createTerrainLayer } from './terrain';
import { Timeline } from './timeline';
import type { ModelKit } from './kit/load';
import { figureUnitModels } from './kit/figures';
import type { UnitModelFactory } from './unitModels';
import type { UnitView } from './units';
import { UnitLayer } from './units';

/** How finely the scene is drawn: phones get fewer pixels and cheaper shadows. */
export type GraphicsQuality = 'high' | 'medium' | 'low';

interface QualityProfile {
  /** The most device pixels per CSS pixel the canvas is drawn with. */
  readonly pixelRatio: number;
  readonly antialias: boolean;
  /** Size of the shadow map, or 0 for no shadows. */
  readonly shadowMap: number;
  readonly softShadows: boolean;
  /** Frames per second while nothing but idling figures moves; 0 for no limit. */
  readonly quietFps: number;
}

export const QUALITY_PROFILES: Readonly<Record<GraphicsQuality, QualityProfile>> = {
  high: { pixelRatio: 2, antialias: true, shadowMap: 2048, softShadows: true, quietFps: 0 },
  medium: { pixelRatio: 1.5, antialias: false, shadowMap: 1024, softShadows: false, quietFps: 30 },
  low: { pixelRatio: 1, antialias: false, shadowMap: 0, softShadows: false, quietFps: 20 },
};
const SKY_COLOR = 0xd7e4ff;
/** Light thrown back from the grass, a little green. */
const GROUND_LIGHT_COLOR = 0x3c4a30;
const AMBIENT_INTENSITY = 1;
const SUN_COLOR = 0xffffff;
const SUN_INTENSITY = 2.3;
/** Where the sun stands from the middle of the map, as a direction. */
const SUN_DIRECTION = { x: -0.55, y: 1, z: 0.35 } as const;
/** World units the view moves on one press of a movement key, at zoom 1. */
const KEY_PAN_STEP = 2;
/** How fast the camera catches up with a turn: the share of the rest covered per second. */
const TURN_SPEED = 10;
/** Longest time one frame may move the animations forward, so a background tab does not jump. */
const MAX_FRAME_SECONDS = 0.1;
/** How long the frame rate is averaged over. */
const STATS_WINDOW_MS = 1000;
/** For this long after the player moves the view, frames are drawn at full speed. */
const INPUT_BUSY_MS = 400;
/** How fast the camera glides to a place it is sent to: the share of the rest covered per second. */
const GLIDE_SPEED = 6;
/** Close enough to the place the camera glides to, in world units. */
const GLIDE_DONE = 0.02;
/**
 * How close a view of a group of hexes, such as the player's army, comes: a hex about this
 * many CSS pixels wide, but no closer than this many times the view of the whole map.
 */
const CLOSE_UP = { hexPixels: 112, closest: 2 } as const;
/** How often shadows follow the idling figures while nothing else moves. */
const IDLE_SHADOW_SECONDS = 0.25;

export interface BattleSceneOptions {
  /** The battle's definitions: the map to draw and what the units are. */
  readonly defs: BattleDefs;
  /** The player clicked a hex or a unit, or beside the map (`null`). */
  onPick?(pick: MapPick | null, kind: PointerKind): void;
  /** The pointer moved to another hex, or off the map (`null`). */
  onHover?(pick: MapPick | null): void;
  /** Builds the units' models; figures from the kit, or placeholders without one. */
  readonly unitModel?: UnitModelFactory;
  /** Loaded models for the terrain and the units; plain shapes when left out. */
  readonly kit?: ModelKit;
  /** A moment of an animation came, such as a blow landing; for the sounds. */
  onCue?(cue: AnimationCue): void;
  /** What the terrain labels say about each kind of terrain; without it there are none. */
  readonly terrainLabel?: TerrainLabelText;
  /** How finely to draw; high when left out. */
  readonly quality?: GraphicsQuality;
}

/** A moment of an animation, and where on the screen it happens. */
export interface AnimationCue {
  readonly kind: CueKind;
  /** The event being animated. */
  readonly event: GameEvent;
  /** The unit the cue is about, if any. */
  readonly unit?: { readonly archetype: Archetype; readonly owner: PlayerSlot };
  /** Where across the screen it happens, from -1 at the left edge to 1 at the right one. */
  readonly pan: number;
}

/** What drawing a frame costs, for the performance panel. */
export interface RenderStats {
  readonly fps: number;
  /** Average time between frames over the last second, in milliseconds. */
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
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
  /** Draws these units as spent for the turn: darker, with grey plates. */
  setSpent(unitIds: Iterable<string>): void;
  /** True while events are still being animated; clicks are ignored meanwhile. */
  readonly animating: boolean;
  /** Glides the camera to bring the hex to the middle of the screen. */
  focus(target: Hex): void;
  /**
   * Brings the hexes, such as the player's army, into a closer view: at once, or gliding there
   * when `smooth`. Asked before the canvas has a size, it happens as soon as it has one.
   */
  frame(group: readonly Hex[], smooth?: boolean): void;
  /** Writes the terrain on the hexes, or takes it off again. */
  showTerrain(on: boolean): void;
  /** Turns the camera by quarter turns. */
  rotate(steps: number): void;
  zoom(factor: number): void;
  /** Call when the canvas element changes size. */
  resize(): void;
  /** What the last second of frames cost. */
  stats(): RenderStats;
  /** Stops rendering and frees GPU resources. */
  dispose(): void;
}

/** Draws a battle on the canvas in an isometric view and reports what the player points at. */
export function createBattleScene(
  canvas: HTMLCanvasElement,
  options: BattleSceneOptions
): BattleScene {
  const { defs } = options;
  const profile = QUALITY_PROFILES[options.quality ?? 'high'];
  const renderer = new WebGLRenderer({
    canvas,
    antialias: profile.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, profile.pixelRatio));
  renderer.shadowMap.enabled = profile.shadowMap > 0;
  renderer.shadowMap.type = profile.softShadows ? PCFSoftShadowMap : PCFShadowMap;
  // Shadows are drawn again only while something moves across the map, and now and then for
  // the figures idling in place; that roughly halves the cost of a quiet frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const hexes = mapHexes(defs.map);
  const bounds = groundBounds(hexes);

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOR);
  const terrain = createTerrainLayer(defs, options.kit?.terrain);
  const unitModel =
    options.unitModel ?? (options.kit ? figureUnitModels(options.kit.units) : undefined);
  const units = new UnitLayer(defs, terrain.surfaceHeight, unitModel);
  const highlights = new HighlightLayer(hexes.length, terrain.surfaceHeight);
  const terrainLabels = new TerrainLabels(
    defs,
    terrain.surfaceHeight,
    options.terrainLabel ?? (() => null)
  );
  const effects = new Group();
  const camps = PLAYER_SLOTS.flatMap((player) => {
    const camp = defs.camps[player];
    if (!camp) return [];
    const marker = new CampMarker(player);
    const { x, z } = hexToWorld(camp);
    marker.object.position.x = x;
    marker.object.position.z = z;
    marker.object.position.y += terrain.surfaceHeight(camp);
    return [marker];
  });
  const sun = createSun();
  scene.add(
    new HemisphereLight(SKY_COLOR, GROUND_LIGHT_COLOR, AMBIENT_INTENSITY),
    sun,
    sun.target,
    terrain.object,
    terrain.fog,
    highlights.object,
    units.object,
    effects,
    terrainLabels.object,
    ...camps.map((marker) => marker.object)
  );

  const camera = createIsometricCamera(1);
  const picker = new Picker(terrain, units);
  const timeline = new Timeline();
  let view: CameraView = frameView(bounds, 1);
  let azimuth = azimuthOf(view.rotation);
  let framed = false;
  let hovered: Hex | null = null;
  /** When the player last moved the view; for a while after, it is drawn at full speed. */
  let lastInput = -Infinity;
  const touched = () => (lastInput = performance.now());
  /** The place the camera is gliding to, if any; moving the view by hand stops it. */
  let glide: { readonly target: GroundPoint; readonly zoom: number | null } | null = null;
  /** A group to frame once the canvas has a size. */
  let pendingFrame: readonly Hex[] | null = null;
  /** Set while animations are skipped to their end, which nobody should hear. */
  let skipping = false;
  const projected = new Vector3();

  function cue(kind: CueKind, event: GameEvent, view?: UnitView): void {
    if (skipping || !options.onCue) return;
    let pan = 0;
    if (view) {
      projected.copy(view.object.position).project(camera);
      pan = Math.max(-1, Math.min(1, projected.x));
    }
    const unit = view && { archetype: view.archetype, owner: view.owner };
    options.onCue({ kind, event, pan, ...(unit && { unit }) });
  }

  function skipAnimations(): void {
    skipping = true;
    timeline.finish();
    skipping = false;
  }

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
    light.castShadow = profile.shadowMap > 0;
    light.shadow.mapSize.set(profile.shadowMap || 1, profile.shadowMap || 1);
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
      if (pendingFrame) frameGroup(pendingFrame, false);
      pendingFrame = null;
    }
  }

  function frameGroup(group: readonly Hex[], smooth: boolean): void {
    const { clientWidth, clientHeight } = canvas;
    if (group.length === 0) return;
    if (!framed || clientWidth === 0 || clientHeight === 0) {
      pendingFrame = group;
      return;
    }
    const close = closeUpView(
      groundBounds(group),
      bounds,
      { width: clientWidth, height: clientHeight },
      view.rotation,
      CLOSE_UP
    );
    if (smooth) {
      glide = { target: close.target, zoom: close.zoom };
    } else {
      glide = null;
      view = close;
    }
  }

  function hover(point: ScreenPoint | null): void {
    touched();
    const pick = point && picker.pick(point, camera);
    const target = pick?.hex ?? null;
    if (target === hovered || (target && hovered && hexEquals(target, hovered))) return;
    hovered = target;
    highlights.setHover(target);
    options.onHover?.(pick);
  }

  const detachControls = attachControls(canvas, {
    click(point, kind) {
      if (!timeline.idle) return;
      options.onPick?.(picker.pick(point, camera), kind);
    },
    hover,
    drag(deltaX, deltaY) {
      touched();
      glide = null;
      const scale = worldUnitsPerPixel(canvas.clientHeight || 1);
      view = panView(view, -deltaX * scale, deltaY * scale, bounds);
    },
    zoom(factor) {
      touched();
      // Zooming by hand wins over a zoom the camera was gliding to.
      if (glide) glide = { ...glide, zoom: null };
      view = zoomView(view, factor);
    },
    rotate(steps) {
      touched();
      view = rotateView(view, steps);
    },
    nudge(right, up) {
      touched();
      glide = null;
      view = panView(view, right * KEY_PAN_STEP, up * KEY_PAN_STEP, bounds);
    },
  });

  function show(state: BattleState, visible: VisibleHexes): void {
    renderer.shadowMap.needsUpdate = true;
    units.sync(state);
    terrain.setFog(visible);
  }

  let lastTime: number | null = null;
  let shadowAge = 0;
  let frames = 0;
  let windowStart: number | null = null;
  let measured = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0 };
  const quietGap = profile.quietFps > 0 ? 1000 / profile.quietFps : 0;
  function frame(time: number): void {
    // While only the figures idle, a cheaper profile draws fewer frames to spare the battery.
    const busy =
      !timeline.idle ||
      glide !== null ||
      Math.abs(azimuthOf(view.rotation) - azimuth) > 0.001 ||
      time - lastInput < INPUT_BUSY_MS;
    if (!busy && quietGap > 0 && lastTime !== null && time - lastTime < quietGap - 2) return;
    const seconds = Math.min(lastTime === null ? 0 : (time - lastTime) / 1000, MAX_FRAME_SECONDS);
    lastTime = time;
    windowStart ??= time;
    frames++;
    if (time - windowStart >= STATS_WINDOW_MS) {
      const elapsed = time - windowStart;
      measured = {
        fps: (frames * 1000) / elapsed,
        frameMs: elapsed / frames,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
      frames = 0;
      windowStart = time;
    }
    shadowAge += seconds;
    if (!timeline.idle || shadowAge >= IDLE_SHADOW_SECONDS) {
      renderer.shadowMap.needsUpdate = true;
      shadowAge = 0;
    }
    timeline.update(seconds);
    units.update(seconds);
    if (glide) {
      const goalZoom = glide.zoom ?? view.zoom;
      view = glideView(view, glide.target, GLIDE_SPEED * seconds, goalZoom);
      const left = Math.hypot(glide.target.x - view.target.x, glide.target.z - view.target.z);
      if (left < GLIDE_DONE && Math.abs(goalZoom - view.zoom) < GLIDE_DONE) glide = null;
    }
    azimuth += (azimuthOf(view.rotation) - azimuth) * Math.min(1, TURN_SPEED * seconds);
    placeCamera(camera, view, azimuth);
    const worldPerPixel = worldUnitsPerPixel(canvas.clientHeight || 1) / view.zoom;
    units.setPixelSize(worldPerPixel);
    terrainLabels.setPixelSize(worldPerPixel);
    for (const marker of camps) marker.setPixelSize(worldPerPixel);
    renderer.render(scene, camera);
  }

  resize();
  placeCamera(camera, view, azimuth);
  renderer.setAnimationLoop(frame);

  return {
    sync(state, visible = null) {
      skipAnimations();
      show(state, visible);
    },
    play(events, state, visible = null) {
      const context = { units, state, effects, cue };
      timeline.enqueue(
        ...events.flatMap((event) => eventSteps(event, context)),
        // Whatever the animation left slightly off is put right at its end, and what the
        // units came to see on the way shows up.
        { duration: 0, end: () => show(state, visible) }
      );
    },
    setHighlights(marks) {
      touched();
      highlights.set(marks);
      const unitOn = (target: Hex) => units.viewAt(target)?.unitId;
      units.setMarks(
        (marks.selected && unitOn(marks.selected)) ?? null,
        (marks.targets ?? []).flatMap((target) => unitOn(target) ?? [])
      );
    },
    setSpent: (unitIds) => units.setSpent(unitIds),
    get animating() {
      return !timeline.idle;
    },
    focus(target) {
      glide = { target: clampToBounds(hexToWorld(target), bounds), zoom: null };
    },
    frame(group, smooth = false) {
      frameGroup(group, smooth);
    },
    showTerrain(on) {
      terrainLabels.show(on);
    },
    rotate(steps) {
      touched();
      view = rotateView(view, steps);
    },
    zoom(factor) {
      touched();
      // Zooming by hand wins over a zoom the camera was gliding to.
      if (glide) glide = { ...glide, zoom: null };
      view = zoomView(view, factor);
    },
    resize,
    stats: () => ({
      ...measured,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }),
    dispose() {
      renderer.setAnimationLoop(null);
      detachControls();
      skipAnimations();
      units.dispose();
      for (const marker of camps) marker.dispose();
      terrainLabels.dispose();
      highlights.dispose();
      terrain.dispose();
      sun.dispose();
      renderer.dispose();
    },
  };
}
