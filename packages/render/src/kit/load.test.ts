import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { LoadedModel } from './load';
import { kitFiles, kitMesh, loadModelKit } from './load';
import { fakeCharacter } from './testKit';

function boxModel(): LoadedModel {
  const scene = new Group();
  const holder = new Group();
  holder.position.y = 2;
  holder.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
  scene.add(holder);
  return { scene, animations: [] };
}

describe('model kit', () => {
  it('bakes the transforms of a kit file into its mesh', () => {
    const { geometry } = kitMesh(boxModel());
    geometry.computeBoundingBox();

    expect(geometry.boundingBox!.min.y).toBeCloseTo(1.5);
  });

  it('loads every tile, decoration and character from under the base URL', async () => {
    const asked: string[] = [];
    const kit = await loadModelKit('/models', (url) => {
      asked.push(url);
      return Promise.resolve(url.includes('/units/') ? fakeCharacter([]) : boxModel());
    });

    expect(asked.sort()).toEqual(
      kitFiles()
        .map((file) => `/models/${file}`)
        .sort()
    );
    expect(Object.keys(kit.terrain.decorations)).toHaveLength(11);
    expect(Object.keys(kit.units).sort()).toEqual(['adventurer', 'hooded', 'horse', 'king']);
  });

  it('fails when a file cannot be loaded, so the game can fall back to shapes', async () => {
    await expect(loadModelKit('/models/', () => Promise.reject(new Error('404')))).rejects.toThrow(
      '404'
    );
  });
});
