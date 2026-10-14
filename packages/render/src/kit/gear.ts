import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Where a piece of gear sits on its bone: offset and turn, in figure heights and radians. */
export interface Mount {
  readonly at?: readonly [number, number, number];
  readonly turn?: readonly [number, number, number];
}

/** Moves and turns a geometry built around its origin into its place on the bone. */
export function mounted(geometry: BufferGeometry, mount: Mount = {}): BufferGeometry {
  const [x, y, z] = mount.at ?? [0, 0, 0];
  const [a, b, c] = mount.turn ?? [0, 0, 0];
  return geometry.applyMatrix4(
    new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion().setFromEuler(new Euler(a, b, c)),
      new Vector3(1, 1, 1)
    )
  );
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const plain = parts.map((part) => {
    const flat = part.index ? part.toNonIndexed() : part;
    flat.deleteAttribute('uv');
    return flat;
  });
  const result = mergeGeometries(plain)!;
  for (const part of [...parts, ...plain]) part.dispose();
  return result;
}

/** A long spear along +y, held a third of the way up. */
export function spear(length: number): BufferGeometry {
  const shaft = new CylinderGeometry(0.012, 0.012, length, 5).translate(0, length / 6, 0);
  const head = new ConeGeometry(0.03, 0.09, 4).translate(0, length / 6 + length / 2 + 0.045, 0);
  return merged([shaft, head]);
}

/** The Roman scutum: a tall curved rectangle with a boss, facing +z. */
export function scutum(): BufferGeometry {
  const board = new CylinderGeometry(0.5, 0.5, 0.42, 10, 1, true, -0.45, 0.9).translate(
    0,
    0,
    -0.47
  );
  const boss = new SphereGeometry(0.045, 6, 4).translate(0, 0, 0.03 + 0.005);
  return merged([board.scale(0.6, 1, 0.6), boss]);
}

/** A round shield (parma, clipeus), facing +z. */
export function roundShield(radius: number): BufferGeometry {
  const board = new CylinderGeometry(radius, radius, 0.02, 12).rotateX(Math.PI / 2);
  const boss = new SphereGeometry(radius * 0.25, 6, 4).translate(0, 0, 0.012);
  return merged([board, boss]);
}

/** A long oval Gallic shield, facing +z. */
export function ovalShield(): BufferGeometry {
  return new CylinderGeometry(0.11, 0.11, 0.02, 12).rotateX(Math.PI / 2).scale(1, 1.9, 1);
}

/** The bowl of a Roman bronze helmet; its crest is a separate piece in its own colour. */
export function helmetBowl(): BufferGeometry {
  return new SphereGeometry(0.078, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
}

/** A helmet crest standing on the bowl. */
export function crest(height: number): BufferGeometry {
  return new BoxGeometry(0.02, height, 0.13).translate(0, 0.072 + height / 2, 0);
}

/** A pointed helmet for the Carthaginian side. */
export function conicalHelmet(): BufferGeometry {
  return merged([
    new ConeGeometry(0.08, 0.1, 8).translate(0, 0.07, 0),
    new CylinderGeometry(0.082, 0.082, 0.025, 8).translate(0, 0.02, 0),
  ]);
}
