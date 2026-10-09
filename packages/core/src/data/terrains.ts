import type { TerrainDef, TerrainTable } from '../map/terrain';

const OPEN_GROUND = {
  blocksSight: false,
  blocksSightFromHill: false,
  isHill: false,
} satisfies Partial<TerrainDef>;

/** Starting values from the design notes; expected to change during balancing. */
export const TERRAINS: TerrainTable = {
  plain: { id: 'plain', moveCost: 1, defenseBonus: 0, ...OPEN_GROUND },
  forest: {
    id: 'forest',
    moveCost: 2,
    defenseBonus: 2,
    ...OPEN_GROUND,
    blocksSight: true,
    hinders: ['cavalry', 'lightCavalry', 'elephant'],
  },
  hill: {
    id: 'hill',
    moveCost: 2,
    defenseBonus: 2,
    blocksSight: true,
    blocksSightFromHill: true,
    isHill: true,
  },
  mountain: {
    id: 'mountain',
    moveCost: 3,
    defenseBonus: 3,
    blocksSight: true,
    blocksSightFromHill: true,
    isHill: false,
    impassableFor: ['cavalry', 'lightCavalry', 'elephant'],
  },
  marsh: { id: 'marsh', moveCost: 3, defenseBonus: -1, ...OPEN_GROUND },
  ford: { id: 'ford', moveCost: 2, defenseBonus: -1, ...OPEN_GROUND, attackBonus: -2 },
  road: { id: 'road', moveCost: 0.5, defenseBonus: 0, ...OPEN_GROUND },
  river: { id: 'river', moveCost: null, defenseBonus: 0, ...OPEN_GROUND },
  sea: { id: 'sea', moveCost: null, defenseBonus: 0, ...OPEN_GROUND },
  camp: { id: 'camp', moveCost: 1, defenseBonus: 3, ...OPEN_GROUND },
};
