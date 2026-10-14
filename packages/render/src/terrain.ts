import type { BufferGeometry, Material } from 'three';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { BattleDefs, Hex, HexKey, PlayerSlot, TerrainId } from '@vermont/core';
import { PLAYER_SLOTS, hexKey, hexNeighbors, mapHexes } from '@vermont/core';
import { HEX_SIZE, hexToWorld } from './layout';
import { PEAK_COLOR, PLAYER_COLORS, TERRAIN_STYLES, TREE_COLOR } from './palette';

/** Hexes are drawn slightly smaller than they are, so the gaps between them show the grid. */
const HEX_FILL = 0.96;
const HEX_CORNERS = 6;

/** Where the trees of a forest hex stand, as offsets from its centre, and how big they are. */
const TREES: readonly (readonly [x: number, z: number, scale: number])[] = [
  [-0.38, -0.22, 1],
  [0.34, -0.3, 0.8],
  [0.05, 0.4, 0.9],
];
const TREE_RADIUS = 0.3;
const TREE_HEIGHT = 0.9;
const PEAK_RADIUS = 0.7;
const PEAK_HEIGHT = 1.1;
const PEAK_SIDES = 5;
const TENT_RADIUS = 0.5;
const TENT_HEIGHT = 0.7;
const TENT_SIDES = 4;
/** How much of its colour a hex keeps while it lies in the fog of war. */
const FOG_SHADE = 0.42;
const UNSHADED = 0xffffff;

/** A mesh of the terrain kit: one tile or one decoration, in the kit's own units. */
export interface KitMesh {
  readonly geometry: BufferGeometry;
  readonly material: Material;
}

export type Decoration =
  | 'treeA'
  | 'treeB'
  | 'rock'
  | 'hill'
  | 'mountain'
  | 'reedA'
  | 'reedB'
  | 'lily'
  | 'tent'
  | 'barrel'
  | 'bridge';

/** Loaded models for the ground: hex tiles and what stands on them. */
export interface TerrainKit {
  /** Distance from the centre of a kit tile to its corners. */
  readonly tileRadius: number;
  readonly grass: KitMesh;
  readonly water: KitMesh;
  readonly decorations: Readonly<Record<Decoration, KitMesh>>;
}

/** Tints of the kit's grass and water tiles, so the terrains tell apart. */
const KIT_TINTS: Readonly<Record<TerrainId, number>> = {
  plain: 0xc2dcac,
  forest: 0xa9c995,
  hill: 0xd9d8a6,
  mountain: 0xb4b2a4,
  marsh: 0x8fa074,
  ford: 0xcff0ff,
  bridge: 0xffffff,
  road: 0xc2dcac,
  river: 0xffffff,
  sea: 0x9cbbe0,
  camp: 0xd8cca6,
};
const WATER_TERRAINS: ReadonlySet<TerrainId> = new Set(['river', 'sea', 'ford', 'bridge']);
const ROAD_TERRAINS: ReadonlySet<TerrainId> = new Set(['road', 'bridge']);
const ROAD_COLOR = 0xc9a879;
const ROAD_WIDTH = 0.34;
const ROAD_THICKNESS = 0.03;

/** The drawn map. Built once: terrain does not change during a battle. */
export interface TerrainLayer {
  readonly object: Group;
  /** Meshes a click on the ground can hit; see `hexOfInstance`. */
  readonly pickTargets: readonly InstancedMesh[];
  /** The hex drawn by an instance of one of the `pickTargets`. */
  hexOfInstance(mesh: InstancedMesh, instanceId: number): Hex | undefined;
  /** Height of the hex's top, where units and highlights are put; 0 off the map. */
  surfaceHeight(target: Hex): number;
  /** Darkens the hexes outside `visible`, with all that stands on them; `null` lifts the fog. */
  setFog(visible: ReadonlySet<HexKey> | null): void;
  /** Whether the hex is drawn darkened by the fog. */
  isFogged(target: Hex): boolean;
  dispose(): void;
}

/** A number from 0 to 1 that depends only on the hex and `salt`, so decorations stay put. */
function noise(target: Hex, salt: number): number {
  const x = Math.sin(target.q * 127.1 + target.r * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * One `InstancedMesh` per terrain type and one per decoration, so the whole map takes a
 * handful of draw calls. With a kit the hexes are its tiles; without one, plain prisms.
 */
export function createTerrainLayer(defs: BattleDefs, kit?: TerrainKit): TerrainLayer {
  const object = new Group();
  const disposables: { dispose(): void }[] = [];
  const hexesByMesh = new Map<InstancedMesh, Hex[]>();
  const heights = new Map<HexKey, number>();
  const shaded: Shaded[] = [];
  let fogged: ReadonlySet<HexKey> | null = null;
  const tileScale = kit ? (HEX_SIZE * HEX_FILL) / kit.tileRadius : 1;

  // A prism one unit tall standing on the ground; instances are stretched to their height.
  const prism = new CylinderGeometry(
    HEX_SIZE * HEX_FILL,
    HEX_SIZE * HEX_FILL,
    1,
    HEX_CORNERS
  ).translate(0, 0.5, 0);
  disposables.push(prism);

  const terrainOf = (target: Hex) => defs.map.hexes[hexKey(target)]?.terrain;
  const byTerrain = new Map<TerrainId, Hex[]>();
  for (const mapHex of mapHexes(defs.map)) {
    const terrain = terrainOf(mapHex)!;
    byTerrain.set(terrain, [...(byTerrain.get(terrain) ?? []), mapHex]);
    heights.set(hexKey(mapHex), TERRAIN_STYLES[terrain].height);
  }

  for (const [terrain, hexes] of byTerrain) {
    const style = TERRAIN_STYLES[terrain];
    let mesh: InstancedMesh;
    if (kit) {
      const tile = WATER_TERRAINS.has(terrain) ? kit.water : kit.grass;
      tile.geometry.computeBoundingBox();
      const box = tile.geometry.boundingBox!;
      const depth = box.max.y - box.min.y;
      // The tile's column reaches down to the ground, whatever the terrain's height.
      const lift = Math.max(tileScale, (style.height + 0.05) / depth);
      const material = tile.material.clone();
      disposables.push(material);
      mesh = instanced(
        tile.geometry,
        material,
        hexes.map((mapHex) => ({
          ...hexToWorld(mapHex),
          y: style.height - box.max.y * lift,
          scale: [tileScale, lift, tileScale],
          hex: mapHex,
        }))
      );
      shaded.push({ mesh, hexes, colors: hexes.map(() => KIT_TINTS[terrain]) });
    } else {
      const material = new MeshStandardMaterial({ color: style.color, flatShading: true });
      disposables.push(material);
      mesh = instanced(
        prism,
        material,
        hexes.map((mapHex) => ({
          ...hexToWorld(mapHex),
          y: 0,
          scale: [1, style.height, 1],
          hex: mapHex,
        }))
      );
      shaded.push({ mesh, hexes });
    }
    mesh.receiveShadow = true;
    hexesByMesh.set(mesh, hexes);
    object.add(mesh);
  }

  const surfaceHeight = (target: Hex) => heights.get(hexKey(target)) ?? 0;
  const standingOn = (
    mapHex: Hex,
    offsetX = 0,
    offsetZ = 0,
    scale = 1,
    rotation = 0
  ): Placement => {
    const center = hexToWorld(mapHex);
    return {
      x: center.x + offsetX,
      y: surfaceHeight(mapHex),
      z: center.z + offsetZ,
      scale: [scale, scale, scale],
      rotation,
      hex: mapHex,
    };
  };
  /** `colors` gives each instance its own colour; without it they all have `color`. */
  const decorate = (
    geometry: BufferGeometry,
    color: number,
    placements: readonly Placement[],
    colors?: readonly number[]
  ): void => {
    disposables.push(geometry);
    if (placements.length === 0) return;
    const material = new MeshStandardMaterial({ color, flatShading: true });
    disposables.push(material);
    addDecoration(geometry, material, placements, colors);
  };
  const addDecoration = (
    geometry: BufferGeometry,
    material: Material,
    placements: readonly Placement[],
    colors?: readonly number[]
  ): void => {
    if (placements.length === 0) return;
    const mesh = instanced(geometry, material, placements);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    shaded.push({ mesh, hexes: placements.map((placement) => placement.hex), colors });
  };

  const camps = PLAYER_SLOTS.flatMap((player) => {
    const camp = defs.camps[player];
    return camp ? [{ player, camp }] : [];
  });

  if (kit) {
    const placed = new Map<Decoration, Placement[]>();
    const colorsOf = new Map<Decoration, number[]>();
    const put = (decoration: Decoration, placement: Placement, color = UNSHADED) => {
      placed.set(decoration, [...(placed.get(decoration) ?? []), placement]);
      colorsOf.set(decoration, [...(colorsOf.get(decoration) ?? []), color]);
    };
    /** A decoration at an offset from the hex centre, turned with the hex's own angle. */
    const scatter = (
      decoration: Decoration,
      mapHex: Hex,
      salt: number,
      x: number,
      z: number,
      scale: number
    ) => {
      const turn = noise(mapHex, salt) * Math.PI * 2;
      put(decoration, standingOn(mapHex, x, z, scale * tileScale, turn));
    };

    for (const mapHex of byTerrain.get('forest') ?? []) {
      TREES.forEach(([x, z, scale], index) =>
        scatter(noise(mapHex, index) < 0.5 ? 'treeA' : 'treeB', mapHex, index + 10, x, z, scale)
      );
    }
    for (const mapHex of byTerrain.get('hill') ?? []) {
      scatter('hill', mapHex, 1, -0.35, -0.3, 0.55);
      scatter('rock', mapHex, 2, 0.45, 0.2, 0.5);
    }
    for (const mapHex of byTerrain.get('mountain') ?? []) {
      scatter('mountain', mapHex, 1, -0.2, -0.35, 0.55);
      scatter('rock', mapHex, 2, 0.45, 0.25, 0.6);
    }
    for (const mapHex of byTerrain.get('marsh') ?? []) {
      scatter('reedA', mapHex, 1, -0.4, -0.2, 1);
      scatter('reedB', mapHex, 2, 0.4, 0.25, 1);
      scatter('lily', mapHex, 3, 0.1, -0.45, 1);
    }
    for (const mapHex of byTerrain.get('ford') ?? []) {
      scatter('rock', mapHex, 1, -0.4, 0.1, 0.45);
      scatter('rock', mapHex, 2, 0.35, -0.3, 0.4);
    }
    for (const mapHex of byTerrain.get('bridge') ?? []) {
      // The bridge spans towards the land: along the first neighbour that is not water.
      const land = hexNeighbors(mapHex).find((next) => {
        const terrain = terrainOf(next);
        return terrain !== undefined && (!WATER_TERRAINS.has(terrain) || terrain === 'bridge');
      });
      const from = hexToWorld(mapHex);
      const to = land ? hexToWorld(land) : { x: from.x, z: from.z + 1 };
      put('bridge', standingOn(mapHex, 0, 0, tileScale, Math.atan2(to.x - from.x, to.z - from.z)));
    }
    for (const { player, camp } of camps) {
      const back = campBackOffset(player);
      const tint = new Color(PLAYER_COLORS[player]).lerp(new Color(UNSHADED), 0.35).getHex();
      put('tent', standingOn(camp, -0.32, back, tileScale * 1.3, 0.3), tint);
      put('tent', standingOn(camp, 0.34, back * 0.6, tileScale * 1.2, -0.4), tint);
      put('barrel', standingOn(camp, 0.5, -back * 0.4, tileScale));
    }

    for (const [decoration, placements] of placed) {
      const piece = kit.decorations[decoration];
      const material = piece.material.clone();
      disposables.push(material);
      addDecoration(piece.geometry, material, placements, colorsOf.get(decoration));
    }

    // Roads: a strip from the middle of each road hex to every road next to it.
    const strips: Placement[] = [];
    for (const terrain of ROAD_TERRAINS) {
      for (const mapHex of byTerrain.get(terrain) ?? []) {
        const from = hexToWorld(mapHex);
        const height = surfaceHeight(mapHex) + ROAD_THICKNESS / 2;
        if (terrain === 'road') {
          strips.push({ ...from, y: height, scale: [ROAD_WIDTH, 1, ROAD_WIDTH], hex: mapHex });
        }
        for (const next of hexNeighbors(mapHex)) {
          const nextTerrain = terrainOf(next);
          if (!nextTerrain || !ROAD_TERRAINS.has(nextTerrain) || terrain === 'bridge') continue;
          const to = hexToWorld(next);
          const half = Math.hypot(to.x - from.x, to.z - from.z) / 2;
          strips.push({
            x: from.x + (to.x - from.x) / 4,
            y: height,
            z: from.z + (to.z - from.z) / 4,
            scale: [ROAD_WIDTH, 1, half],
            rotation: Math.atan2(to.x - from.x, to.z - from.z),
            hex: mapHex,
          });
        }
      }
    }
    decorate(new BoxGeometry(1, ROAD_THICKNESS, 1), ROAD_COLOR, strips);
  } else {
    decorate(
      new ConeGeometry(TREE_RADIUS, TREE_HEIGHT, HEX_CORNERS).translate(0, TREE_HEIGHT / 2, 0),
      TREE_COLOR,
      (byTerrain.get('forest') ?? []).flatMap((mapHex) =>
        TREES.map(([x, z, scale]) => standingOn(mapHex, x, z, scale))
      )
    );
    decorate(
      new ConeGeometry(PEAK_RADIUS, PEAK_HEIGHT, PEAK_SIDES).translate(0, PEAK_HEIGHT / 2, 0),
      PEAK_COLOR,
      (byTerrain.get('mountain') ?? []).map((mapHex) => standingOn(mapHex))
    );
    // A tent in its side's colour on each camp. It stands at the back of the hex, off the unit.
    decorate(
      new ConeGeometry(TENT_RADIUS, TENT_HEIGHT, TENT_SIDES).translate(0, TENT_HEIGHT / 2, 0),
      UNSHADED,
      camps.map(({ player, camp }) => standingOn(camp, 0, campBackOffset(player), 0.7)),
      camps.map(({ player }) => PLAYER_COLORS[player])
    );
  }

  const isFogged = (target: Hex) => fogged !== null && !fogged.has(hexKey(target));
  const setFog = (visible: ReadonlySet<HexKey> | null): void => {
    fogged = visible;
    const color = new Color();
    for (const { mesh, hexes, colors } of shaded) {
      hexes.forEach((mapHex, index) => {
        color.set(colors?.[index] ?? UNSHADED);
        if (isFogged(mapHex)) color.multiplyScalar(FOG_SHADE);
        mesh.setColorAt(index, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
  setFog(null);

  return {
    object,
    pickTargets: [...hexesByMesh.keys()],
    hexOfInstance: (mesh, instanceId) => hexesByMesh.get(mesh)?.[instanceId],
    surfaceHeight,
    setFog,
    isFogged,
    dispose() {
      for (const disposable of disposables) disposable.dispose();
      object.clear();
    },
  };
}

/** Player 0 starts in the north, so its camp's back is further north; player 1 mirrors it. */
function campBackOffset(player: PlayerSlot): number {
  const BACK = 0.45;
  return player === 0 ? -BACK : BACK;
}

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly scale: readonly [number, number, number];
  /** Turn about the vertical axis, in radians. */
  readonly rotation?: number;
  /** The hex the instance belongs to; it goes dark with it. */
  readonly hex: Hex;
}

/** A mesh whose instances are darkened with the hexes they stand on. */
interface Shaded {
  readonly mesh: InstancedMesh;
  readonly hexes: readonly Hex[];
  /** Colour of each instance in full light; white when left out. */
  readonly colors?: readonly number[];
}

const UP = new Vector3(0, 1, 0);

function instanced(
  geometry: BufferGeometry,
  material: Material,
  placements: readonly Placement[]
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const turn = new Quaternion();
  placements.forEach((placement, index) => {
    position.set(placement.x, placement.y, placement.z);
    scale.set(...placement.scale);
    turn.setFromAxisAngle(UP, placement.rotation ?? 0);
    mesh.setMatrixAt(index, matrix.compose(position, turn, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
