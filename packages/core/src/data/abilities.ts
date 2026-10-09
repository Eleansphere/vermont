import type { AbilityTable } from '../units/unitType';

/** Starting values from the design notes; expected to change during balancing. */
export const ABILITIES: AbilityTable = {
  /** Javelins thrown before the first charge: a one-off attack bonus. */
  pilum: { id: 'pilum', kind: 'triggered', params: { attack: 2 } },
  /** Swaps places with a neighbouring unit of its own side. */
  lineRelief: { id: 'lineRelief', kind: 'active', params: {} },
  shieldWall: {
    id: 'shieldWall',
    kind: 'passive',
    params: { defense: 3 },
    against: ['cavalry', 'lightCavalry'],
  },
  /** Bonus to the attacks the unit starts itself, not to its counter-attacks. */
  furiousCharge: { id: 'furiousCharge', kind: 'passive', params: { attack: 2 } },
  /** Attacks without being struck back and keeps `movement` points to ride away. */
  hitAndRun: { id: 'hitAndRun', kind: 'passive', params: { movement: 4 } },
  /** Weakens the listed enemies standing next to the unit and shakes whoever it hits. */
  fear: {
    id: 'fear',
    kind: 'passive',
    params: { attack: -2, moraleLoss: 1 },
    against: ['cavalry', 'lightCavalry'],
  },
};
