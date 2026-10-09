import type { BufferGeometry, Material } from 'three';
import {
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
import { PLAYER_SLOTS, hexKey, mapHexes } from '@vermont/core';
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

/** One `InstancedMesh` per terrain type, so the whole map takes a handful of draw calls. */
export function createTerrainLayer(defs: BattleDefs): TerrainLayer {
  const object = new Group();
  const disposables: (BufferGeometry | Material)[] = [];
  const hexesByMesh = new Map<InstancedMesh, Hex[]>();
  const heights = new Map<HexKey, number>();
  const shaded: Shaded[] = [];
  let fogged: ReadonlySet<HexKey> | null = null;

  // A prism one unit tall standing on the ground; instances are stretched to their height.
  const prism = new CylinderGeometry(
    HEX_SIZE * HEX_FILL,
    HEX_SIZE * HEX_FILL,
    1,
    HEX_CORNERS
  ).translate(0, 0.5, 0);
  disposables.push(prism);

  const byTerrain = new Map<TerrainId, Hex[]>();
  for (const mapHex of mapHexes(defs.map)) {
    const terrain = defs.map.hexes[hexKey(mapHex)]!.terrain;
    byTerrain.set(terrain, [...(byTerrain.get(terrain) ?? []), mapHex]);
    heights.set(hexKey(mapHex), TERRAIN_STYLES[terrain].height);
  }

  for (const [terrain, hexes] of byTerrain) {
    const style = TERRAIN_STYLES[terrain];
    const material = new MeshStandardMaterial({ color: style.color, flatShading: true });
    disposables.push(material);
    const mesh = instanced(
      prism,
      material,
      hexes.map((mapHex) => ({
        ...hexToWorld(mapHex),
        y: 0,
        scale: [1, style.height, 1],
        hex: mapHex,
      }))
    );
    mesh.receiveShadow = true;
    hexesByMesh.set(mesh, hexes);
    shaded.push({ mesh, hexes });
    object.add(mesh);
  }

  const surfaceHeight = (target: Hex) => heights.get(hexKey(target)) ?? 0;
  const standingOn = (mapHex: Hex, offsetX = 0, offsetZ = 0, scale = 1): Placement => {
    const center = hexToWorld(mapHex);
    return {
      x: center.x + offsetX,
      y: surfaceHeight(mapHex),
      z: center.z + offsetZ,
      scale: [scale, scale, scale],
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
    const mesh = instanced(geometry, material, placements);
    mesh.castShadow = true;
    object.add(mesh);
    shaded.push({ mesh, hexes: placements.map((placement) => placement.hex), colors });
  };

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
  const camps = PLAYER_SLOTS.flatMap((player) => {
    const camp = defs.camps[player];
    return camp ? [{ player, camp }] : [];
  });
  decorate(
    new ConeGeometry(TENT_RADIUS, TENT_HEIGHT, TENT_SIDES).translate(0, TENT_HEIGHT / 2, 0),
    UNSHADED,
    camps.map(({ player, camp }) => standingOn(camp, 0, campBackOffset(player), 0.7)),
    camps.map(({ player }) => PLAYER_COLORS[player])
  );

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

function instanced(
  geometry: BufferGeometry,
  material: Material,
  placements: readonly Placement[]
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, placements.length);
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const upright = new Quaternion();
  placements.forEach((placement, index) => {
    position.set(placement.x, placement.y, placement.z);
    scale.set(...placement.scale);
    mesh.setMatrixAt(index, matrix.compose(position, upright, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}
