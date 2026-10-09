import type { MapGrid } from '../map/mapGrid';
import { gridSize, mapFromGrid } from '../map/mapGrid';
import type { MapTable } from '../scenario/scenario';

/**
 * A river comes in from the west and ends in a marsh in the middle of the field. It can be
 * crossed at two fords or ridden around on the open eastern side. Each army has a hill in
 * front of its lines and a wood on one wing.
 */
// prettier-ignore
const TREBIA_GRID: MapGrid = [
  '. . . . . . . . . . . . . .',
  ' . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . .',
  ' . . . . h h . . . . . f f .',
  '. . . . . . . . . . . . f .',
  ' ~ ~ = ~ ~ . . . . . . . . .',
  '. . . . . ~ = ~ ~ m m . . .',
  ' . f . . . . . . . . . . . .',
  '. f f . . . . . . h h . . .',
  ' . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . .',
  ' . . . . . . . . . . . . . .',
];

/**
 * A wide plain with a river down its western side. A bridge in the north and a ford in the
 * south lead to the far bank, where a road joins them: the way round the flank of both lines.
 * Each army has a hill ahead of one wing.
 */
// prettier-ignore
const CANNAE_GRID: MapGrid = [
  'f . ~ . . . . . . . . . . . . .',
  ' f . ~ . . . . . . . . . . . . .',
  '. . ~ . . . . . . . . . . . . .',
  ' . # B . . . . . . . . . . . f f',
  '. # ~ . . . . . . . . . . . . f',
  ' # ~ . . h h . . . . . . . . . .',
  '# ~ . . . . . . . . . . h h . .',
  ' # ~ . . . . . . . . . . . . . .',
  '. # = . . . . . . . . . . . . .',
  ' . . ~ . . . . . . . . . . . . .',
  'f . ~ . . . . . . . . . . . . .',
  ' f . ~ . . . . . . . . . . . . .',
];

/** Open ground all the way across, with a low hill and a patch of wood towards each wing. */
// prettier-ignore
const ZAMA_GRID: MapGrid = [
  '. . . . . . . . . . . . . . . .',
  ' . . . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . . . .',
  ' f f . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . . . .',
  ' . . . . . . . . . . . . h h . .',
  '. . h h . . . . . . . . . . . .',
  ' . . . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . . f f',
  ' . . . . . . . . . . . . . . . .',
  '. . . . . . . . . . . . . . . .',
  ' . . . . . . . . . . . . . . . .',
];

export const TREBIA_SIZE = gridSize('trebia', TREBIA_GRID);
export const CANNAE_SIZE = gridSize('cannae', CANNAE_GRID);
export const ZAMA_SIZE = gridSize('zama', ZAMA_GRID);

export const MAPS: MapTable = {
  trebia: mapFromGrid('trebia', TREBIA_GRID),
  cannae: mapFromGrid('cannae', CANNAE_GRID),
  zama: mapFromGrid('zama', ZAMA_GRID),
};
