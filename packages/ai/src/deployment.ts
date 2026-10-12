import type { BattleDefs, BattleState, Command, Hex, PlayerSlot, Unit } from '@vermont/core';
import { deploymentHexes, opponentOf, reserveUnits, unitTypeOf } from '@vermont/core';

/** Where a unit belongs in the battle line. */
type Post = 'wing' | 'line' | 'rear';

/** Wings are placed first, so that the line fills the middle between them. */
const POSTS: readonly Post[] = ['wing', 'line', 'rear'];
/** Units this fast stand on the wings. */
const FAST_MOVEMENT = 6;
/** Row a shooter is put in, counted from the front one: right behind the line. */
const REAR_ROW = 1;
/** A row further from where the unit belongs weighs more than any place along the row. */
const ROW_WEIGHT = 100;

function postOf(defs: BattleDefs, unit: Unit): Post {
  const type = unitTypeOf(defs, unit);
  if (type.range !== undefined) return 'rear';
  return type.movement >= FAST_MOVEMENT ? 'wing' : 'line';
}

/** How far east the hex lies; hexes of one row are one apart. */
function across(hex: Hex): number {
  return hex.q + hex.r / 2;
}

/**
 * The next command of a deployment that draws the army up as a battle line: cavalry on the
 * wings, the foot in the middle of the front row and the shooters behind it.
 */
export function plannedDeployment(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): Command {
  const zone = defs.deploymentZones[player] ?? [];
  const enemyCamp = defs.camps[opponentOf(player)];
  // Rows of the zone from the front; without a camp to face, the zone's own order tells.
  const rows = [...new Set(zone.map((zoneHex) => zoneHex.r))];
  if (enemyCamp) rows.sort((a, b) => Math.abs(a - enemyCamp.r) - Math.abs(b - enemyCamp.r));
  const middle = zone.reduce((sum, zoneHex) => sum + across(zoneHex), 0) / (zone.length || 1);

  const misplaced = (post: Post, target: Hex): number => {
    const row = rows.indexOf(target.r);
    const fromMiddle = Math.abs(across(target) - middle);
    if (post === 'wing') return row * ROW_WEIGHT - fromMiddle;
    return Math.abs(row - (post === 'rear' ? REAR_ROW : 0)) * ROW_WEIGHT + fromMiddle;
  };

  const waiting = reserveUnits(state, player);
  for (const post of POSTS) {
    for (const unit of waiting.filter((candidate) => postOf(defs, candidate) === post)) {
      const [best] = deploymentHexes(state, defs, unit).sort(
        (a, b) => misplaced(post, a) - misplaced(post, b)
      );
      if (best) return { type: 'DeployUnit', unitId: unit.id, hex: best };
    }
  }
  return { type: 'EndDeployment' };
}
