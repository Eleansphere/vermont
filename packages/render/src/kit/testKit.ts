import type { Material } from 'three';
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  MeshStandardMaterial,
  QuaternionKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from 'three';
import type { TerrainKit } from '../terrain';
import type { CharacterSource } from './bake';
import type { UnitKit } from './figures';

/** Bones of the fake rig, in the Quaternius naming the recipes use. */
const BONES = ['Root', 'Head', 'WristL', 'WristR'] as const;

export interface FakePart {
  readonly name: string;
  readonly material: string;
  readonly color?: number;
  /** The bone the part's vertices follow. */
  readonly bone?: (typeof BONES)[number];
}

/**
 * A skinned character 2 units tall: a root bone at the feet, a head bone up top and two hands,
 * with one box per part. Its armature and meshes are scaled by 100, like the real exports.
 */
export function fakeCharacter(
  parts: readonly FakePart[],
  clips: readonly string[] = []
): CharacterSource {
  const scene = new Group();
  scene.name = 'RootNode';
  const armature = new Group();
  armature.name = 'CharacterArmature';
  armature.scale.setScalar(100);
  scene.add(armature);

  const root = new Bone();
  root.name = 'Root';
  const head = new Bone();
  head.name = 'Head';
  head.position.y = 0.018;
  const left = new Bone();
  left.name = 'WristL';
  left.position.set(0.004, 0.01, 0);
  const right = new Bone();
  right.name = 'WristR';
  right.position.set(-0.004, 0.01, 0);
  root.add(head, left, right);
  armature.add(root);
  scene.updateMatrixWorld(true);

  for (const part of parts) {
    const boneIndex = BONES.indexOf(part.bone ?? 'Root');
    const geometry = new BoxGeometry(0.004, 0.02, 0.004).translate(0, 0.01, 0);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute(
      'skinIndex',
      new Uint16BufferAttribute(
        new Array<number>(count * 4).fill(0).map((_, i) => (i % 4 === 0 ? boneIndex : 0)),
        4
      )
    );
    geometry.setAttribute(
      'skinWeight',
      new Float32BufferAttribute(
        new Array<number>(count * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)),
        4
      )
    );
    const material = new MeshStandardMaterial({ color: part.color ?? 0x808080 });
    material.name = part.material;
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = part.name;
    mesh.scale.setScalar(100);
    scene.add(mesh);
    mesh.updateMatrixWorld(true);
    // Each part gets a skeleton of its own over the same bones, as the glTF loader makes them.
    mesh.bind(new Skeleton([root, head, left, right]));
  }

  const animations = clips.map(
    (name) =>
      new AnimationClip(name, 1, [
        new QuaternionKeyframeTrack('Head.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.38, 0, 0.92]),
      ])
  );
  return { scene, animations };
}

/** Clips the recipes look for, under the armature's name as the exporter writes them. */
export const HUMAN_CLIP_NAMES = [
  'Idle_Sword',
  'Run',
  'Sword_Slash',
  'Punch_Right',
  'HitRecieve',
  'Death',
].map((name) => `CharacterArmature|${name}`);

export function fakeUnitKit(): UnitKit {
  const human = () =>
    fakeCharacter(
      [
        { name: 'Body', material: 'Blue', color: 0x0000ff },
        { name: 'Legs', material: 'Brown' },
        { name: 'Head', material: 'Skin', bone: 'Head' },
        { name: 'Crown', material: 'Gold', bone: 'Head' },
        { name: 'Backpack', material: 'Brown' },
      ],
      HUMAN_CLIP_NAMES
    );
  return {
    king: human(),
    adventurer: human(),
    hooded: human(),
    horse: fakeCharacter([{ name: 'Horse', material: 'Main' }], ['Idle', 'Gallop', 'Death']),
  };
}

/** Boxes in place of the kit's tiles and decorations. */
export function fakeTerrainKit(): TerrainKit {
  const piece = (height: number, top = 0) => ({
    geometry: new BoxGeometry(1.7, height, 2).translate(0, top - height / 2, 0),
    material: new MeshStandardMaterial() as Material,
  });
  const decoration = () => piece(0.5, 0.5);
  return {
    tileRadius: 2 / Math.sqrt(3),
    grass: piece(1),
    water: piece(0.8, -0.2),
    decorations: {
      treeA: decoration(),
      treeB: decoration(),
      rock: decoration(),
      hill: decoration(),
      mountain: decoration(),
      reedA: decoration(),
      reedB: decoration(),
      lily: decoration(),
      tent: decoration(),
      barrel: decoration(),
      bridge: decoration(),
    },
  };
}
