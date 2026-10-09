import type { BufferGeometry, Object3D } from 'three';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { Archetype, PlayerSlot, UnitTypeDef } from '@vermont/core';
import { PLAYER_COLORS } from './palette';

/**
 * Builds what a unit looks like. The model stands on the ground at its origin, faces +z and
 * fits on one hex. This is the one place to swap the placeholders for loaded glTF models.
 */
export type UnitModelFactory = (type: UnitTypeDef, owner: PlayerSlot) => Object3D;

const GEAR_COLOR = 0x3a3d45;
const MOUNT_COLOR = 0x8a6a4a;
const ELEPHANT_COLOR = 0x8f9096;
const BASE_RADIUS = 0.62;
const BASE_HEIGHT = 0.08;
const BASE_SIDES = 24;

interface Paints {
  readonly body: MeshStandardMaterial;
  readonly gear: MeshStandardMaterial;
  readonly mount: MeshStandardMaterial;
}

type Part = readonly [
  geometry: BufferGeometry,
  paint: keyof Paints,
  x: number,
  y: number,
  z: number,
];

const foot = (width: number, height: number): Part => [
  new BoxGeometry(width, height, 0.36),
  'body',
  0,
  height / 2,
  0,
];
const shaft = (length: number, x: number): Part => [
  new CylinderGeometry(0.03, 0.03, length, 6),
  'gear',
  x,
  length / 2,
  0.1,
];
const rider = (y: number): Part => [new BoxGeometry(0.26, 0.4, 0.26), 'body', 0, y, -0.05];

/** Shapes that tell the archetypes apart at a glance; real models replace them later. */
const SHAPES: Readonly<Record<Archetype, () => readonly Part[]>> = {
  spear: () => [foot(0.7, 0.55), shaft(1.2, -0.22), shaft(1.2, 0), shaft(1.2, 0.22)],
  heavyInfantry: () => [foot(0.7, 0.6), [new BoxGeometry(0.76, 0.42, 0.06), 'gear', 0, 0.36, 0.22]],
  lightInfantry: () => [foot(0.5, 0.45)],
  ranged: () => [
    [new ConeGeometry(0.3, 0.6, 8), 'body', 0, 0.3, 0],
    [new SphereGeometry(0.09, 8, 6), 'gear', 0, 0.68, 0],
  ],
  cavalry: () => [
    [new BoxGeometry(0.34, 0.4, 0.9), 'mount', 0, 0.38, 0],
    rider(0.76),
    [new BoxGeometry(0.4, 0.3, 0.06), 'gear', 0, 0.74, 0.14],
  ],
  lightCavalry: () => [[new BoxGeometry(0.28, 0.34, 0.8), 'mount', 0, 0.34, 0], rider(0.68)],
  elephant: () => [
    [new BoxGeometry(0.62, 0.66, 0.95), 'mount', 0, 0.55, -0.05],
    [new BoxGeometry(0.4, 0.4, 0.3), 'mount', 0, 0.62, 0.52],
    [new CylinderGeometry(0.07, 0.05, 0.5, 6), 'mount', 0, 0.3, 0.7],
    [new BoxGeometry(0.44, 0.28, 0.44), 'body', 0, 1.02, -0.1],
  ],
};

/** A low-poly stand-in built from boxes and cones, in its side's colour. */
export const placeholderUnitModel: UnitModelFactory = (type, owner) => {
  const paints: Paints = {
    body: new MeshStandardMaterial({ color: PLAYER_COLORS[owner], flatShading: true }),
    gear: new MeshStandardMaterial({ color: GEAR_COLOR, flatShading: true }),
    mount: new MeshStandardMaterial({
      color: type.archetype === 'elephant' ? ELEPHANT_COLOR : MOUNT_COLOR,
      flatShading: true,
    }),
  };

  const model = new Group();
  const base = new Mesh(
    new CylinderGeometry(BASE_RADIUS, BASE_RADIUS, BASE_HEIGHT, BASE_SIDES),
    paints.body
  );
  base.position.y = BASE_HEIGHT / 2;
  base.receiveShadow = true;
  model.add(base);

  for (const [geometry, paint, x, y, z] of SHAPES[type.archetype]()) {
    const part = new Mesh(geometry, paints[paint]);
    part.position.set(x, y + BASE_HEIGHT, z);
    part.castShadow = true;
    model.add(part);
  }
  return model;
};
