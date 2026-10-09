import type { Hex } from '../hex/hex';
import { rectangleHex } from '../map/shapes';
import type { ScenarioDef, ScenarioTable } from '../scenario/scenario';
import { TREBIA_HEIGHT, TREBIA_WIDTH } from './maps';

/** Columns left free on either edge of a deployment zone. */
const ZONE_MARGIN = 1;

/** Whole rows of a rectangular map without its edge columns, in the order given. */
function rowsZone(width: number, rows: readonly number[]): Hex[] {
  return rows.flatMap((row) =>
    Array.from({ length: width - 2 * ZONE_MARGIN }, (_, index) =>
      rectangleHex(index + ZONE_MARGIN, row)
    )
  );
}

const LAST_ROW = TREBIA_HEIGHT - 1;

/**
 * Loosely after the battle on the Trebia (218 BC): Rome in the north, Carthage in the south,
 * twelve units each. The armies are listed wing to wing, the way they line up when deployed
 * in order.
 */
const TREBIA: ScenarioDef = {
  id: 'trebia',
  name: 'Trebia',
  mapId: 'trebia',
  sides: [
    {
      factionId: 'rome',
      army: [
        { typeId: 'equites', count: 1 },
        { typeId: 'velites', count: 1 },
        { typeId: 'hastati', count: 3 },
        { typeId: 'triarii', count: 2 },
        { typeId: 'principes', count: 3 },
        { typeId: 'velites', count: 1 },
        { typeId: 'equites', count: 1 },
      ],
      camp: rectangleHex(7, 0),
      deploymentZone: rowsZone(TREBIA_WIDTH, [2, 1, 0]),
    },
    {
      factionId: 'carthage',
      army: [
        { typeId: 'numidian-cavalry', count: 1 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'gallic-mercenaries', count: 2 },
        { typeId: 'libyan-spearmen', count: 3 },
        { typeId: 'war-elephants', count: 1 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'iberian-cavalry', count: 2 },
        { typeId: 'numidian-cavalry', count: 1 },
      ],
      camp: rectangleHex(6, LAST_ROW),
      deploymentZone: rowsZone(TREBIA_WIDTH, [LAST_ROW - 2, LAST_ROW - 1, LAST_ROW]),
    },
  ],
};

export const SCENARIOS: ScenarioTable = {
  trebia: TREBIA,
};
