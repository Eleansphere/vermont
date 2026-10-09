import type { GameData } from '../scenario/scenario';
import { ABILITIES } from './abilities';
import { FACTIONS } from './factions';
import { MAPS } from './maps';
import { RULES } from './rules';
import { TERRAINS } from './terrains';
import { UNIT_TYPES } from './unitTypes';

/** The data the game ships with. */
export const GAME_DATA: GameData = {
  maps: MAPS,
  factions: FACTIONS,
  terrains: TERRAINS,
  unitTypes: UNIT_TYPES,
  abilities: ABILITIES,
  rules: RULES,
};
