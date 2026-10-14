import type { AnimationClip, Bone, BufferGeometry, Material, Object3D } from 'three';
import {
  BufferAttribute,
  Color,
  Matrix4,
  Mesh,
  Quaternion,
  MeshStandardMaterial,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** A loaded glTF character: its scene and the clips that move its bones. */
export interface CharacterSource {
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
}

/** A piece of a character's mesh, picked by the mesh's and the material's name. */
export interface PartFilter {
  /** Mesh names to leave out, e.g. the legs of a rider. */
  readonly withoutMeshes?: RegExp;
  /** Material names to leave out, e.g. a crown. */
  readonly withoutMaterials?: RegExp;
  /** New colours for materials, by material name. */
  readonly recolor?: readonly (readonly [RegExp, number])[];
}

/**
 * Rigid gear held by a bone: a shield, a spear, a helmet. The geometry is measured in figure
 * heights and set in the bone's frame, without the bone's scale.
 */
export interface Gear {
  readonly bone: string;
  readonly geometry: BufferGeometry;
  readonly color: number;
}

/**
 * A character made into one skinned mesh with vertex colours: all its parts and its gear in a
 * single draw call. Clone it with `instantiate` for each figure on the field.
 */
export interface BakedFigure {
  /** The bone hierarchy with the merged mesh bound to it. */
  readonly template: Object3D;
  readonly geometry: BufferGeometry;
  readonly animations: readonly AnimationClip[];
  /** How tall the figure stands in the template's units. */
  readonly height: number;
}

const BAKED_ATTRIBUTES = ['position', 'normal', 'color', 'skinIndex', 'skinWeight'] as const;

/** The bones a glTF exporter renamed stay findable by their sanitized names. */
function sanitize(name: string): string {
  return name.replace(/[\s.:/[\]]/g, '');
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function colorOf(material: Material, filter: PartFilter): Color {
  for (const [pattern, color] of filter.recolor ?? []) {
    if (pattern.test(material.name)) return new Color(color);
  }
  const color = (material as MeshStandardMaterial).color as Color | undefined;
  return color ? color.clone() : new Color(0xffffff);
}

/**
 * A copy of the geometry with plain float positions and normals. Quantized files store them as
 * normalized integers, which would clip once the copy is moved into another space.
 */
function withFloatAttributes(source: BufferGeometry): BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  for (const name of ['position', 'normal'] as const) {
    const attribute = geometry.getAttribute(name);
    if (!attribute || (attribute.array instanceof Float32Array && !attribute.normalized)) continue;
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < attribute.itemSize; c++) {
        values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      }
    }
    geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
  }
  return geometry;
}

/** Copies a geometry with only the baked attributes, non-indexed, in one flat colour. */
function bakedPart(
  source: BufferGeometry,
  toBindSpace: Matrix4,
  color: Color,
  remapBone: (index: number) => number
): BufferGeometry {
  const geometry = withFloatAttributes(source).applyMatrix4(toBindSpace);
  for (const name of Object.keys(geometry.attributes)) {
    if (!(BAKED_ATTRIBUTES as readonly string[]).includes(name)) geometry.deleteAttribute(name);
  }
  geometry.morphAttributes = {};
  const count = geometry.getAttribute('position').count;
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  // Read through the attribute, which undoes the normalized bytes some exporters use.
  const sourceIndex = geometry.getAttribute('skinIndex');
  const sourceWeight = geometry.getAttribute('skinWeight');
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < 4; c++) {
      indices[i * 4 + c] = remapBone(sourceIndex.getComponent(i, c));
      weights[i * 4 + c] = sourceWeight.getComponent(i, c);
    }
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  geometry.clearGroups();
  return geometry;
}

/** A rigid piece glued to one bone, placed where the bone is in the bind pose. */
function bakedGear(gear: Gear, boneIndex: number, toMesh: Matrix4): BufferGeometry {
  const geometry = (
    gear.geometry.index ? gear.geometry.toNonIndexed() : gear.geometry.clone()
  ).applyMatrix4(toMesh);
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const color = new Color(gear.color);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  geometry.clearGroups();
  return geometry;
}

/**
 * Merges the skinned parts of a character that pass `filter`, and the gear, into one mesh
 * bound to the character's skeleton. All parts must share one rig; bones are matched by name.
 */
export function bakeFigure(
  sources: readonly { readonly source: CharacterSource; readonly filter?: PartFilter }[],
  gear: readonly Gear[] = []
): BakedFigure {
  const main = sources[0]!.source;
  const height = standingHeight(main.scene);
  const template = cloneSkinned(main.scene);
  template.updateMatrixWorld(true);

  const skinned: SkinnedMesh[] = [];
  template.traverse((node) => {
    if (node instanceof SkinnedMesh) skinned.push(node);
  });
  const anchor = skinned[0];
  if (!anchor) throw new Error('The character has no skinned mesh');
  const skeleton = anchor.skeleton;
  const boneIndexByName = new Map(
    skeleton.bones.map((bone, index) => [sanitize(bone.name), index])
  );
  // Not `bindMatrixInverse`: an attached mesh keeps that as the inverse of its world matrix.
  const meshFromWorld = anchor.bindMatrix.clone().invert();

  const parts: BufferGeometry[] = [];
  for (const { source, filter = {} } of sources) {
    const meshes: SkinnedMesh[] = [];
    source.scene.updateMatrixWorld(true);
    source.scene.traverse((node) => {
      if (node instanceof SkinnedMesh) meshes.push(node);
    });
    for (const mesh of meshes) {
      const owner = mesh.parent && !(mesh.parent as Bone).isBone ? mesh.parent : mesh;
      if (filter.withoutMeshes?.test(mesh.name) || filter.withoutMeshes?.test(owner.name)) continue;
      const [material] = materialsOf(mesh);
      if (!material || filter.withoutMaterials?.test(material.name)) continue;
      const remap = (index: number) => {
        const bone = mesh.skeleton.bones[index];
        return (bone && boneIndexByName.get(sanitize(bone.name))) ?? 0;
      };
      // From the part's own bind space into the anchor's, so all parts share one bind matrix
      // and one set of inverse bind matrices. Quantized files fold each part's dequantization
      // into its inverse bind matrices; the difference to the anchor's is the same for every
      // bone, so one bone tells it.
      const shared = mesh.skeleton.bones.findIndex((bone) =>
        boneIndexByName.has(sanitize(bone.name))
      );
      const toAnchor = new Matrix4();
      if (shared >= 0) {
        const anchorInverse = skeleton.boneInverses[remap(shared)]!;
        toAnchor.copy(anchorInverse).invert().multiply(mesh.skeleton.boneInverses[shared]!);
      }
      const toBindSpace = meshFromWorld.clone().multiply(toAnchor).multiply(mesh.bindMatrix);
      parts.push(bakedPart(mesh.geometry, toBindSpace, colorOf(material, filter), remap));
    }
  }
  for (const piece of gear) {
    const boneIndex = boneIndexByName.get(sanitize(piece.bone));
    if (boneIndex === undefined) continue;
    // The gear follows the bone as it stands in the rest pose, in world units: back through
    // the bone's world matrix and its bind, into the mesh's own space.
    const bone = skeleton.bones[boneIndex]!;
    const position = new Vector3();
    const rotation = new Quaternion();
    bone.matrixWorld.decompose(position, rotation, new Vector3());
    const inWorld = new Matrix4().compose(position, rotation, new Vector3(height, height, height));
    const restSkin = new Matrix4().multiplyMatrices(
      bone.matrixWorld,
      skeleton.boneInverses[boneIndex]!
    );
    const toMesh = meshFromWorld.clone().multiply(restSkin.invert()).multiply(inWorld);
    parts.push(bakedGear(piece, boneIndex, toMesh));
  }

  const loose = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!loose) throw new Error('The figure parts could not be merged');
  // Flat shading takes its normals from the faces, so the vertices need none; without them
  // the corners that faces share become one vertex each, and far fewer are skinned per frame.
  loose.deleteAttribute('normal');
  const geometry = mergeVertices(loose);
  loose.dispose();
  geometry.computeBoundingSphere();

  const merged = new SkinnedMesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 })
  );
  merged.name = 'figure';
  merged.castShadow = true;
  merged.frustumCulled = false;
  anchor.parent!.add(merged);
  merged.bind(skeleton, anchor.bindMatrix.clone());
  for (const mesh of skinned) mesh.removeFromParent();
  // Leftover groups of multi-material meshes are empty now.
  const empty: Object3D[] = [];
  template.traverse((node) => {
    if (
      !(node as Bone).isBone &&
      node !== template &&
      node.children.length === 0 &&
      node !== merged
    )
      empty.push(node);
  });
  for (const node of empty) if (!(node instanceof Mesh)) node.removeFromParent();

  return { template, geometry, animations: main.animations, height };
}

/** A fresh copy of the figure with its own bones; it shares the geometry. */
export function instantiate(figure: BakedFigure, material: Material): Object3D {
  const copy = cloneSkinned(figure.template);
  copy.traverse((node) => {
    if (node instanceof SkinnedMesh) node.material = material;
  });
  return copy;
}

/**
 * How tall a character stands. Skinned meshes are measured on their bones, because some
 * exporters scale the rig by 100 and leave the geometry tiny.
 */
export function standingHeight(scene: Object3D): number {
  scene.updateMatrixWorld(true);
  let min = Infinity;
  let max = -Infinity;
  const vertex = new Vector3();
  scene.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    const position = node.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      node.applyBoneTransform(i, vertex);
      vertex.applyMatrix4(node.matrixWorld);
      min = Math.min(min, vertex.y);
      max = Math.max(max, vertex.y);
    }
  });
  return max > min ? max - min : 1;
}
