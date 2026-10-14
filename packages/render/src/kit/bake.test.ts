import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { bakeFigure, instantiate, standingHeight } from './bake';
import { fakeCharacter } from './testKit';

function skinnedIn(object: Object3D): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  object.traverse((node) => {
    if (node instanceof SkinnedMesh) found.push(node);
  });
  return found;
}

/** Where a vertex of a skinned mesh is drawn, in world space. */
function drawnAt(mesh: SkinnedMesh, index: number): Vector3 {
  mesh.updateMatrixWorld(true);
  const vertex = new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index);
  return mesh.applyBoneTransform(index, vertex).applyMatrix4(mesh.matrixWorld);
}

describe('baking a figure', () => {
  const character = () =>
    fakeCharacter([
      { name: 'Body', material: 'Blue', color: 0x0000ff },
      { name: 'Crown', material: 'Gold', bone: 'Head' },
      { name: 'Backpack', material: 'Brown' },
    ]);
  const vertices = (object: Object3D) =>
    skinnedIn(object).reduce((sum, mesh) => sum + mesh.geometry.getAttribute('position').count, 0);

  it('measures how tall a character stands, through its scaled rig', () => {
    expect(standingHeight(character().scene)).toBeCloseTo(2);
  });

  it('merges the parts into one skinned mesh and leaves out what the filter drops', () => {
    const source = character();
    const all = bakeFigure([{ source }]);
    const trimmed = bakeFigure([
      { source, filter: { withoutMeshes: /Backpack/, withoutMaterials: /^Gold$/ } },
    ]);

    expect(skinnedIn(all.template)).toHaveLength(1);
    expect(vertices(all.template)).toBe(3 * 36);
    expect(vertices(trimmed.template)).toBe(36);
  });

  it('paints each part in its material colour, or in the colour the filter gives', () => {
    const baked = bakeFigure([
      {
        source: character(),
        filter: { recolor: [[/^Blue$/, 0xff0000]], withoutMeshes: /Crown|Backpack/ },
      },
    ]);
    const colors = baked.geometry.getAttribute('color');

    const painted = new Color().fromBufferAttribute(colors, 0);
    expect(painted.getHex()).toBe(0xff0000);
  });

  it('keeps every vertex where it was drawn before the merge', () => {
    const source = character();
    const original = skinnedIn(source.scene)[0]!;
    const baked = bakeFigure([{ source, filter: { withoutMeshes: /Crown|Backpack/ } }]);
    const merged = skinnedIn(baked.template)[0]!;

    const index = original.geometry.index!.getX(0);
    expect(drawnAt(merged, 0).distanceTo(drawnAt(original, index))).toBeLessThan(1e-6);
  });

  it('glues the gear to its bone, so it moves with it', () => {
    const baked = bakeFigure(
      [{ source: character(), filter: { withoutMeshes: /Body|Crown|Backpack/ } }],
      [
        {
          bone: 'WristR',
          geometry: new BoxGeometry(0.1, 0.1, 0.1).translate(0, 0.5, 0),
          color: 0x00ff00,
        },
      ]
    );
    const figure = instantiate(baked, new MeshStandardMaterial());
    const mesh = skinnedIn(figure)[0]!;
    const hand = figure.getObjectByName('WristR')!;

    figure.updateMatrixWorld(true);
    const before = drawnAt(mesh, 0);
    hand.rotation.z = Math.PI / 2;
    figure.updateMatrixWorld(true);
    const after = drawnAt(mesh, 0);

    expect(before.y).toBeGreaterThan(
      figure.getObjectByName('WristR')!.getWorldPosition(new Vector3()).y
    );
    expect(after.distanceTo(before)).toBeGreaterThan(0.3);
  });

  it('gives each copy its own bones and the material it is handed', () => {
    const baked = bakeFigure([{ source: character() }]);
    const material = new MeshStandardMaterial();
    const first = instantiate(baked, material);
    const second = instantiate(baked, material);

    first.getObjectByName('Head')!.rotation.x = 1;

    expect(second.getObjectByName('Head')!.rotation.x).toBeCloseTo(0);
    expect(skinnedIn(first)[0]!.material).toBe(material);
    expect(skinnedIn(first)[0]!.geometry).toBe(skinnedIn(second)[0]!.geometry);
  });
});
