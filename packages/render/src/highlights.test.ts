import { describe, expect, it } from 'vitest';
import type { InstancedMesh } from 'three';
import { Matrix4, Vector3 } from 'three';
import { hex } from '@vermont/core';
import { HighlightLayer } from './highlights';
import { hexToWorld } from './layout';

const SURFACE = 0.3;

function shownCounts(layer: HighlightLayer): number[] {
  return layer.object.children.map((child) => (child as InstancedMesh).count);
}

describe('highlight layer', () => {
  it('shows nothing until told to', () => {
    const layer = new HighlightLayer(10, () => SURFACE);

    expect(shownCounts(layer)).toEqual([0, 0, 0, 0, 0]);
  });

  it('marks the reach, path, targets, selection and hovered hex', () => {
    const layer = new HighlightLayer(10, () => SURFACE);

    layer.set({
      selected: hex(0, 0),
      reach: [hex(1, 0), hex(2, 0), hex(0, 1)],
      path: [hex(1, 0), hex(2, 0)],
      targets: [hex(3, 0)],
    });
    layer.setHover(hex(2, 0));

    expect(shownCounts(layer)).toEqual([3, 2, 1, 1, 1]);
  });

  it('puts a mark just above the top of its hex', () => {
    const layer = new HighlightLayer(10, () => SURFACE);
    layer.set({ reach: [hex(2, 1)] });

    const matrix = new Matrix4();
    (layer.object.children[0] as InstancedMesh).getMatrixAt(0, matrix);
    const position = new Vector3().setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(hexToWorld(hex(2, 1)).x);
    expect(position.z).toBeCloseTo(hexToWorld(hex(2, 1)).z);
    expect(position.y).toBeGreaterThan(SURFACE);
  });

  it('clears marks that are left out and never shows more than the map has hexes', () => {
    const layer = new HighlightLayer(2, () => SURFACE);

    layer.set({ selected: hex(0, 0), reach: [hex(1, 0), hex(2, 0), hex(3, 0)] });
    expect(shownCounts(layer)).toEqual([2, 0, 0, 1, 0]);

    layer.set({});
    expect(shownCounts(layer)).toEqual([0, 0, 0, 0, 0]);
  });
});
