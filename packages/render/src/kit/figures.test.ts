import { describe, expect, it } from 'vitest';
import { AnimationClip, Mesh, SkinnedMesh } from 'three';
import type { Object3D } from 'three';
import { UNIT_TYPES } from '@vermont/core';
import { FIGURE_RECIPES, figureUnitModels, figuresLeft, findClip, formation } from './figures';
import { fakeUnitKit } from './testKit';

function figuresIn(object: Object3D, visibleOnly = false): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  object.traverse((node) => {
    if (!(node instanceof SkinnedMesh)) return;
    let shown = true;
    for (let current: Object3D | null = node; current; current = current.parent) {
      if (!current.visible) shown = false;
    }
    if (shown || !visibleOnly) found.push(node);
  });
  return found;
}

describe('unit figures', () => {
  it('has a recipe for every unit type', () => {
    const missing = Object.keys(UNIT_TYPES).filter((typeId) => !FIGURE_RECIPES[typeId]);

    expect(missing).toEqual([]);
  });

  it.each([
    [4, 1, 4],
    [4, 0.76, 4],
    [4, 0.75, 3],
    [4, 0.3, 2],
    [4, 0.01, 1],
    [4, 0, 0],
    [2, 0.5, 1],
  ])('keeps %i figures at %f health down to %i', (count, share, left) => {
    expect(figuresLeft(count, share)).toBe(left);
  });

  it('stands the figures apart on the hex', () => {
    for (const count of [1, 2, 3, 4]) {
      const spots = formation(count);
      expect(spots).toHaveLength(count);
      for (const [x, z] of spots) expect(Math.hypot(x, z)).toBeLessThan(0.6);
    }
  });

  it('finds a clip with or without the armature in its name', () => {
    const clips = [
      new AnimationClip('CharacterArmature|Death', 1, []),
      new AnimationClip('Idle', 1, []),
    ];

    expect(findClip(clips, ['Death'])?.name).toBe('CharacterArmature|Death');
    expect(findClip(clips, ['Missing', 'Idle'])?.name).toBe('Idle');
    expect(findClip(clips, ['Missing'])).toBeUndefined();
  });

  it('draws a unit as its recipe says: four men on foot, two riders on horses', () => {
    const models = figureUnitModels(fakeUnitKit());

    const hastati = models(UNIT_TYPES.hastati!, 0);
    const equites = models(UNIT_TYPES.equites!, 0);

    expect(figuresIn(hastati.object)).toHaveLength(4);
    // a rider and a horse on each of the two places
    expect(figuresIn(equites.object)).toHaveLength(4);
  });

  it('gives every unit a standard and seats the mahout on his elephant', () => {
    const models = figureUnitModels(fakeUnitKit());
    const elephants = models(UNIT_TYPES['war-elephants']!, 1);
    const meshes = (object: Object3D) => {
      const found: Mesh[] = [];
      object.traverse((node) => {
        if (node instanceof Mesh && !(node instanceof SkinnedMesh)) found.push(node);
      });
      return found;
    };

    // the standard and the elephant
    expect(meshes(elephants.object)).toHaveLength(2);
    expect(figuresIn(elephants.object)).toHaveLength(1);
    expect(meshes(models(UNIT_TYPES.velites!, 0).object)).toHaveLength(1);
  });

  it('rocks the elephant while it walks and topples it when it dies', () => {
    const model = figureUnitModels(fakeUnitKit())(UNIT_TYPES['war-elephants']!, 0);
    let body: Object3D | undefined;
    model.object.traverse((node) => {
      if (node instanceof Mesh && node.children.length > 0) body = node;
    });

    model.pose?.('walk');
    model.update?.(0.08);
    expect(body!.rotation.z).not.toBe(0);

    model.pose?.('death');
    model.update?.(1);
    expect(body!.rotation.z).toBeCloseTo(Math.PI / 2);
  });

  it('lets figures fall as the unit loses health', () => {
    const model = figureUnitModels(fakeUnitKit())(UNIT_TYPES.principes!, 1);

    model.setStrength?.(0.5);
    expect(figuresIn(model.object, true)).toHaveLength(2);
    model.setStrength?.(1);
    expect(figuresIn(model.object, true)).toHaveLength(4);
  });

  it('plays the clip of a pose and moves it on', () => {
    const model = figureUnitModels(fakeUnitKit())(UNIT_TYPES.triarii!, 0);
    const head = model.object.getObjectByName('Head')!;
    const turnedBefore = head.quaternion.clone();

    model.pose?.('death');
    model.update?.(0.5);

    expect(head.quaternion.equals(turnedBefore)).toBe(false);
  });

  it('bakes each type and side once and shares the geometry between units', () => {
    const models = figureUnitModels(fakeUnitKit());
    const first = figuresIn(models(UNIT_TYPES.hastati!, 0).object)[0]!;
    const second = figuresIn(models(UNIT_TYPES.hastati!, 0).object)[0]!;
    const enemy = figuresIn(models(UNIT_TYPES.hastati!, 1).object)[0]!;

    expect(second.geometry).toBe(first.geometry);
    expect(second.material).not.toBe(first.material);
    expect(enemy.geometry).not.toBe(first.geometry);
  });

  it('falls back to the placeholder for a type without a recipe', () => {
    const unknown = { ...UNIT_TYPES.hastati!, id: 'unknown' };
    const model = figureUnitModels(fakeUnitKit())(unknown, 1);

    expect(figuresIn(model.object)).toHaveLength(0);
    expect(model.pose).toBeUndefined();
  });
});
