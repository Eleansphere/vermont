import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  BufferAttribute,
  Color,
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

/** Gives every vertex of the geometry one colour, so pieces can share a vertex-colour material. */
function painted(geometry: BufferGeometry, color: number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.deleteAttribute('uv');
  const count = flat.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const paint = new Color(color);
  for (let i = 0; i < count; i++) paint.toArray(colors, i * 3);
  flat.setAttribute('color', new BufferAttribute(colors, 3));
  return flat;
}

const POLE_COLOR = 0x5e4229;
const FINIAL_COLOR = 0xc9a24a;
const ELEPHANT_COLOR = 0x8d8e93;
const TUSK_COLOR = 0xece6d6;

/**
 * A unit's standard: a pole with a cloth in the side's colour, standing on the ground at its
 * origin, the cloth towards +x. In world units.
 */
export function banner(side: number): BufferGeometry {
  const height = 1.05;
  return merged([
    painted(new CylinderGeometry(0.016, 0.016, height, 5).translate(0, height / 2, 0), POLE_COLOR),
    painted(new BoxGeometry(0.2, 0.012, 0.012).translate(0.1, height - 0.04, 0), POLE_COLOR),
    painted(new BoxGeometry(0.2, 0.17, 0.008).translate(0.1, height - 0.13, 0), side),
    painted(new ConeGeometry(0.03, 0.07, 4).translate(0, height + 0.035, 0), FINIAL_COLOR),
  ]);
}

/**
 * A war elephant facing +z with a saddle cloth in the side's colour, about 1.1 long and 0.85
 * high, standing at its origin. In world units.
 */
export function elephant(side: number): BufferGeometry {
  const grey = (geometry: BufferGeometry) => painted(geometry, ELEPHANT_COLOR);
  const legs = [
    [-0.17, 0.26],
    [0.17, 0.26],
    [-0.17, -0.24],
    [0.17, -0.24],
  ].map(([x, z]) => grey(new CylinderGeometry(0.085, 0.075, 0.4, 6).translate(x!, 0.2, z!)));
  const ears = [-1, 1].map((sideways) =>
    grey(
      new BoxGeometry(0.025, 0.24, 0.2)
        .rotateY(sideways * 0.5)
        .translate(sideways * 0.19, 0.64, 0.42)
    )
  );
  const tusks = [-1, 1].map((sideways) =>
    painted(
      new ConeGeometry(0.022, 0.2, 5)
        .rotateX(Math.PI / 2 + 0.5)
        .translate(sideways * 0.08, 0.44, 0.66),
      TUSK_COLOR
    )
  );
  return merged([
    grey(new SphereGeometry(1, 8, 6).scale(0.31, 0.29, 0.47).translate(0, 0.55, 0)),
    grey(new SphereGeometry(1, 7, 5).scale(0.19, 0.2, 0.19).translate(0, 0.64, 0.47)),
    grey(new CylinderGeometry(0.035, 0.065, 0.42, 6).rotateX(-0.25).translate(0, 0.36, 0.66)),
    grey(new CylinderGeometry(0.012, 0.012, 0.3, 4).rotateX(0.5).translate(0, 0.48, -0.5)),
    painted(new BoxGeometry(0.5, 0.05, 0.46).translate(0, 0.84, -0.02), side),
    painted(new BoxGeometry(0.62, 0.22, 0.04).translate(0, 0.72, -0.02), side),
    ...legs,
    ...ears,
    ...tusks,
  ]);
}
