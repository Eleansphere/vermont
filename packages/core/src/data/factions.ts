import type { FactionTable } from '../scenario/faction';

export const FACTIONS: FactionTable = {
  rome: {
    id: 'rome',
    name: 'Rome',
    unitTypes: ['velites', 'hastati', 'principes', 'triarii', 'equites'],
  },
  carthage: {
    id: 'carthage',
    name: 'Carthage',
    unitTypes: [
      'balearic-slingers',
      'libyan-spearmen',
      'gallic-mercenaries',
      'numidian-cavalry',
      'iberian-cavalry',
      'war-elephants',
    ],
  },
};
