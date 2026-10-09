import type { Hex } from '../hex/hex';
import type { GridSize } from '../map/mapGrid';
import { rectangleHex } from '../map/shapes';
import type { ScenarioDef, ScenarioTable } from '../scenario/scenario';
import { CANNAE_SIZE, TREBIA_SIZE, ZAMA_SIZE } from './maps';

/** Columns left free on either edge of a deployment zone. */
const ZONE_MARGIN = 1;
/** How many rows deep a deployment zone is. */
const ZONE_DEPTH = 3;

/** The hexes of a row from one column to another, both included, west to east. */
function rowHexes(row: number, firstColumn: number, lastColumn: number): Hex[] {
  return Array.from({ length: lastColumn - firstColumn + 1 }, (_, index) =>
    rectangleHex(firstColumn + index, row)
  );
}

/** The rows at the northern edge of a map, the one nearest the enemy first. */
function northRows(): number[] {
  return Array.from({ length: ZONE_DEPTH }, (_, index) => ZONE_DEPTH - 1 - index);
}

/** The rows at the southern edge of a map, the one nearest the enemy first. */
function southRows({ height }: GridSize): number[] {
  return Array.from({ length: ZONE_DEPTH }, (_, index) => height - ZONE_DEPTH + index);
}

/** Whole rows of a map without its edge columns, in the order given. */
function rowsZone({ width }: GridSize, rows: readonly number[]): Hex[] {
  return rows.flatMap((row) => rowHexes(row, ZONE_MARGIN, width - 1 - ZONE_MARGIN));
}

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
      deploymentZone: rowsZone(TREBIA_SIZE, northRows()),
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
      camp: rectangleHex(6, TREBIA_SIZE.height - 1),
      deploymentZone: rowsZone(TREBIA_SIZE, southRows(TREBIA_SIZE)),
    },
  ],
};

/** The river of Cannae runs down column 2; both armies stand east of it. */
const CANNAE_ROME_COLUMNS = [5, 13] as const;
const CANNAE_ROME_RESERVE_COLUMNS = [7, 11] as const;
const CANNAE_CARTHAGE_COLUMNS = [3, 14] as const;

/**
 * Loosely after Cannae (216 BC). Rome brings the bigger army and packs it deep: nine units in
 * front and the triarii with the skirmishers behind their middle. Carthage has no elephants
 * and stands in one longer line, the Gauls in its centre and cavalry on both wings.
 */
const CANNAE: ScenarioDef = {
  id: 'cannae',
  name: 'Cannae',
  mapId: 'cannae',
  sides: [
    {
      factionId: 'rome',
      army: [
        { typeId: 'equites', count: 1 },
        { typeId: 'hastati', count: 2 },
        { typeId: 'principes', count: 3 },
        { typeId: 'hastati', count: 2 },
        { typeId: 'equites', count: 1 },
        { typeId: 'velites', count: 1 },
        { typeId: 'triarii', count: 3 },
        { typeId: 'velites', count: 1 },
      ],
      camp: rectangleHex(9, 0),
      deploymentZone: [
        ...rowHexes(2, ...CANNAE_ROME_COLUMNS),
        ...rowHexes(1, ...CANNAE_ROME_RESERVE_COLUMNS),
        ...rowHexes(1, CANNAE_ROME_COLUMNS[0], CANNAE_ROME_RESERVE_COLUMNS[0] - 1),
        ...rowHexes(1, CANNAE_ROME_RESERVE_COLUMNS[1] + 1, CANNAE_ROME_COLUMNS[1]),
        ...rowHexes(0, ...CANNAE_ROME_COLUMNS),
      ],
    },
    {
      factionId: 'carthage',
      army: [
        { typeId: 'iberian-cavalry', count: 2 },
        { typeId: 'libyan-spearmen', count: 2 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'gallic-mercenaries', count: 2 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'libyan-spearmen', count: 2 },
        { typeId: 'numidian-cavalry', count: 2 },
      ],
      camp: rectangleHex(8, CANNAE_SIZE.height - 1),
      deploymentZone: southRows(CANNAE_SIZE).flatMap((row) =>
        rowHexes(row, ...CANNAE_CARTHAGE_COLUMNS)
      ),
    },
  ],
};

/**
 * Loosely after Zama (202 BC), on open ground. Rome has the stronger cavalry this time, two
 * units on each wing; Carthage has three units of elephants spread along its line.
 */
const ZAMA: ScenarioDef = {
  id: 'zama',
  name: 'Zama',
  mapId: 'zama',
  sides: [
    {
      factionId: 'rome',
      army: [
        { typeId: 'equites', count: 2 },
        { typeId: 'velites', count: 1 },
        { typeId: 'hastati', count: 3 },
        { typeId: 'principes', count: 3 },
        { typeId: 'triarii', count: 2 },
        { typeId: 'velites', count: 1 },
        { typeId: 'equites', count: 2 },
      ],
      camp: rectangleHex(8, 0),
      deploymentZone: rowsZone(ZAMA_SIZE, northRows()),
    },
    {
      factionId: 'carthage',
      army: [
        { typeId: 'numidian-cavalry', count: 1 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'gallic-mercenaries', count: 1 },
        { typeId: 'war-elephants', count: 1 },
        { typeId: 'libyan-spearmen', count: 1 },
        { typeId: 'gallic-mercenaries', count: 1 },
        { typeId: 'war-elephants', count: 1 },
        { typeId: 'libyan-spearmen', count: 1 },
        { typeId: 'gallic-mercenaries', count: 1 },
        { typeId: 'war-elephants', count: 1 },
        { typeId: 'libyan-spearmen', count: 1 },
        { typeId: 'balearic-slingers', count: 1 },
        { typeId: 'iberian-cavalry', count: 1 },
      ],
      camp: rectangleHex(7, ZAMA_SIZE.height - 1),
      deploymentZone: rowsZone(ZAMA_SIZE, southRows(ZAMA_SIZE)),
    },
  ],
};

export const SCENARIOS: ScenarioTable = {
  trebia: TREBIA,
  cannae: CANNAE,
  zama: ZAMA,
};
