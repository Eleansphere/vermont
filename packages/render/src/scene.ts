import { AmbientLight, Color, GridHelper, Scene, WebGLRenderer } from 'three';
import { createIsometricCamera, resizeIsometricCamera } from './camera';

const BACKGROUND_COLOR = 0x1b1f27;
const GRID_SIZE = 40;
const GRID_DIVISIONS = 40;
const GRID_COLOR = 0x3a4252;
const MAX_PIXEL_RATIO = 2;

export interface BattleScene {
  /** Call when the canvas element changes size. */
  resize(): void;
  /** Stops rendering and frees GPU resources. */
  dispose(): void;
}

/** Starts an empty isometric scene on the canvas. */
export function createBattleScene(canvas: HTMLCanvasElement): BattleScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOR);
  scene.add(new AmbientLight(0xffffff, 1));
  const grid = new GridHelper(GRID_SIZE, GRID_DIVISIONS, GRID_COLOR, GRID_COLOR);
  scene.add(grid);

  const camera = createIsometricCamera(1);

  function resize(): void {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    resizeIsometricCamera(camera, clientWidth / clientHeight);
  }

  resize();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  function dispose(): void {
    renderer.setAnimationLoop(null);
    grid.dispose();
    renderer.dispose();
  }

  return { resize, dispose };
}
