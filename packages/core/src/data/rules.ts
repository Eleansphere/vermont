import type { BattleRules } from '../game/rules';

/** Starting values from the design notes; expected to change during balancing. */
export const RULES: BattleRules = {
  combat: {
    baseDamage: 3,
    damageSpread: 0.1,
    minAttackDamage: 1,
    counterFactor: 0.5,
    woundedFloor: 0.5,
    advantageFactor: 1.25,
    advantages: {
      spear: ['cavalry', 'lightCavalry'],
      heavyInfantry: [],
      lightInfantry: ['spear', 'elephant'],
      ranged: ['spear', 'elephant'],
      cavalry: ['ranged', 'lightInfantry'],
      lightCavalry: ['ranged', 'lightInfantry'],
      elephant: ['spear', 'heavyInfantry'],
    },
    flankBonus: 0.1,
    downhillAttack: 1,
    hinderedAttack: -2,
  },
  morale: {
    max: 10,
    shakenAt: 4,
    routingAt: 1,
    shakenAttackFactor: 0.75,
    lossWhenHit: 2,
    lossWhenEncircled: 1,
    encircledAt: 3,
    lossWhenAllyDies: 1,
    gainForWonAttack: 1,
    recoveryPerTurn: 1,
  },
};
