import type { Archetype, UnitTypeDef } from '@vermont/core';

/** One stroke or filled shape of an icon, as SVG path data in a 24 × 24 box. */
export interface IconPath {
  readonly d: string;
  /** Filled shapes are solid; the others are drawn as lines. */
  readonly fill?: boolean;
}

/** Width of the lines of an icon in its 24 × 24 box. */
export const ICON_STROKE = 2.2;

const HORSE_HEAD =
  'M7 21L7 15C5 12 6 7 10 5L12 2L13.5 4.8C17 6 19.5 9.5 19.5 13L16 13.5L14 11L13 14L16.5 21Z';

/**
 * The sign of each kind of unit, the same on the map, in the army bar and in the panels. Solid
 * signs are the heavy troops, outlined ones the light.
 */
export const UNIT_ICONS: Readonly<Record<Archetype, readonly IconPath[]>> = {
  // A tall shield with its boss.
  heavyInfantry: [
    { d: 'M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3z' },
    { d: 'M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0z', fill: true },
  ],
  // A spear with a broad head.
  spear: [{ d: 'M4 20L16 8' }, { d: 'M20.5 3.5L13 6.5L17.5 11Z', fill: true }],
  // Two javelins.
  lightInfantry: [
    { d: 'M3 17L15 5' },
    { d: 'M18 2L13.5 3.5L16.5 6.5Z', fill: true },
    { d: 'M8 22L20 10' },
    { d: 'M23 7L18.5 8.5L21.5 11.5Z', fill: true },
  ],
  // A sling with its stone.
  ranged: [
    { d: 'M4 4C6 13 18 13 20 4' },
    { d: 'M9 15.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0z', fill: true },
  ],
  cavalry: [{ d: HORSE_HEAD, fill: true }],
  lightCavalry: [{ d: HORSE_HEAD }],
  elephant: [
    { d: 'M6 12a7 5 0 1 0 14 0a7 5 0 1 0 -14 0z', fill: true },
    { d: 'M2.5 9.5a4 4 0 1 0 8 0a4 4 0 1 0 -8 0z', fill: true },
    { d: 'M8 14h3v7h-3z M15 14h3v7h-3z', fill: true },
    { d: 'M3.2 11.5C2 15 2.4 18.5 5 19.5' },
  ],
};

/** How a unit type is signed: its archetype's icon, and pips that tell apart types sharing it. */
export interface UnitIcon {
  readonly archetype: Archetype;
  /** 0 for the first type of its archetype in its faction, 1 for the next one, and so on. */
  readonly pips: number;
}

/**
 * The sign of a unit type. Two types of one faction with the same archetype, such as hastati
 * and principes, share the icon; the later one in the table gets a pip.
 */
export function unitIcon(
  unitTypes: Readonly<Record<string, UnitTypeDef>>,
  type: UnitTypeDef
): UnitIcon {
  const kin = Object.values(unitTypes).filter(
    (other) => other.factionId === type.factionId && other.archetype === type.archetype
  );
  return {
    archetype: type.archetype,
    pips: Math.max(
      0,
      kin.findIndex((other) => other.id === type.id)
    ),
  };
}
