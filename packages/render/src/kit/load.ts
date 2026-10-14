import type { AnimationClip, Object3D } from 'three';
import { Mesh } from 'three';
import type { Decoration, KitMesh, TerrainKit } from '../terrain';
import type { CharacterSource } from './bake';
import type { UnitKit } from './figures';

/** What a glTF file holds for the kit: its scene and its clips. */
export interface LoadedModel {
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
}

/** Loads one glTF file; the game passes three's `GLTFLoader`, tests pass a fake. */
export type ModelLoader = (url: string) => Promise<LoadedModel>;

/** Everything the renderer draws from model files. */
export interface ModelKit {
  readonly terrain: TerrainKit;
  readonly units: UnitKit;
}

/** Corner distance of the KayKit hex tiles. */
const KAYKIT_TILE_RADIUS = 2 / Math.sqrt(3);

const TERRAIN_FILES = {
  grass: 'hex_grass',
  water: 'hex_water',
} as const;

const DECORATION_FILES: Readonly<Record<Decoration, string>> = {
  treeA: 'tree_single_A',
  treeB: 'tree_single_B',
  rock: 'rock_single_A',
  hill: 'hill_single_A',
  mountain: 'mountain_A_grass',
  reedA: 'waterplant_A',
  reedB: 'waterplant_B',
  lily: 'waterlily_A',
  tent: 'tent',
  barrel: 'barrel',
  bridge: 'building_bridge_A',
};

const UNIT_FILES: Readonly<Record<keyof UnitKit, string>> = {
  king: 'king.glb',
  adventurer: 'adventurer.glb',
  hooded: 'hooded.glb',
  horse: 'horse.glb',
};

/** The single mesh of a kit file, with its node transforms baked into the geometry. */
export function kitMesh(model: LoadedModel): KitMesh {
  model.scene.updateMatrixWorld(true);
  let found: Mesh | undefined;
  model.scene.traverse((node) => {
    if (!found && node instanceof Mesh) found = node;
  });
  if (!found) throw new Error('The model has no mesh');
  const material = Array.isArray(found.material) ? found.material[0]! : found.material;
  return { geometry: found.geometry.clone().applyMatrix4(found.matrixWorld), material };
}

/** Every file the kit needs, relative to the folder it is served from. */
export function kitFiles(): string[] {
  return [
    ...Object.values(TERRAIN_FILES).map((name) => `terrain/${name}.gltf`),
    ...Object.values(DECORATION_FILES).map((name) => `terrain/${name}.gltf`),
    ...Object.values(UNIT_FILES).map((name) => `units/${name}`),
  ];
}

/** Loads the terrain tiles, decorations and characters from `baseUrl`. */
export async function loadModelKit(baseUrl: string, load: ModelLoader): Promise<ModelKit> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const terrainMesh = async (name: string) => kitMesh(await load(`${base}terrain/${name}.gltf`));
  const character = async (file: string): Promise<CharacterSource> => {
    const model = await load(`${base}units/${file}`);
    return { scene: model.scene, animations: model.animations };
  };

  const [grass, water, decorationList, unitList] = await Promise.all([
    terrainMesh(TERRAIN_FILES.grass),
    terrainMesh(TERRAIN_FILES.water),
    Promise.all(
      (Object.entries(DECORATION_FILES) as [Decoration, string][]).map(
        async ([id, name]) => [id, await terrainMesh(name)] as const
      )
    ),
    Promise.all(
      (Object.entries(UNIT_FILES) as [keyof UnitKit, string][]).map(
        async ([id, file]) => [id, await character(file)] as const
      )
    ),
  ]);
  return {
    terrain: {
      tileRadius: KAYKIT_TILE_RADIUS,
      grass,
      water,
      decorations: Object.fromEntries(decorationList) as Record<Decoration, KitMesh>,
    },
    units: Object.fromEntries(unitList) as unknown as UnitKit,
  };
}
