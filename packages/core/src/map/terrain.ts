import type { Archetype } from '../archetype';

export type TerrainId =
  | 'plain'
  | 'forest'
  | 'hill'
  | 'mountain'
  | 'marsh'
  | 'ford'
  | 'bridge'
  | 'road'
  | 'river'
  | 'sea'
  | 'camp';

export interface TerrainDef {
  readonly id: TerrainId;
  /** Movement points needed to enter the hex; `null` means nobody can enter. */
  readonly moveCost: number | null;
  /** Added to the defence of a unit standing on the hex. */
  readonly defenseBonus: number;
  /** Hides what lies behind the hex from an observer on low ground. */
  readonly blocksSight: boolean;
  /** Hides what lies behind the hex even from an observer on a hill. */
  readonly blocksSightFromHill: boolean;
  /** A unit here sees and shoots one hex further, and over low obstacles. */
  readonly isHill: boolean;
  /** Archetypes that cannot enter the hex at all. */
  readonly impassableFor?: readonly Archetype[];
  /** Movement cost for archetypes that pay something other than `moveCost`. */
  readonly moveCostFor?: Readonly<Partial<Record<Archetype, number>>>;
  /** Added to the attack of a unit striking from the hex. */
  readonly attackBonus?: number;
  /** Archetypes that fight badly here: they strike weaker and get no `defenseBonus`. */
  readonly hinders?: readonly Archetype[];
}

export type TerrainTable = Readonly<Record<TerrainId, TerrainDef>>;

/** Movement points the archetype pays to enter the terrain, or `null` if it cannot. */
export function terrainMoveCost(terrain: TerrainDef, archetype: Archetype): number | null {
  if (terrain.moveCost === null) return null;
  if (terrain.impassableFor?.includes(archetype)) return null;
  return terrain.moveCostFor?.[archetype] ?? terrain.moveCost;
}
