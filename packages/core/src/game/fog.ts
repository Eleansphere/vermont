import type { Hex, HexKey } from '../hex/hex';
import { hexKey } from '../hex/hex';
import type { SightContext } from '../sight/sight';
import { visibleHexes } from '../sight/sight';
import type { BattleState, PlayerSlot } from './battleState';
import type { GameEvent } from './command';
import type { BattleDefs } from './rules';
import type { Unit } from './unit';
import { fieldedUnits, isFielded, unitHexes, unitTypeOf } from './unit';

/** What one player knows about a battle. */
export interface PlayerView {
  readonly player: PlayerSlot;
  /**
   * The battle as the player knows it: enemy units they cannot see are left out and the dice
   * are hidden. It is for looking at and for planning commands; the commands themselves are
   * dispatched against the real state.
   */
  readonly state: BattleState;
  /** Hexes the player's units and camp see between them. */
  readonly visible: ReadonlySet<HexKey>;
}

/** Dice a player may not look at: knowing the state would tell them the next rolls. */
const HIDDEN_RNG = { seed: 0, state: 0 } as const;

/** Whether nothing is hidden: the battle is played without the fog, or it is over. */
export function isFogLifted(state: BattleState, defs: BattleDefs): boolean {
  return !defs.rules.fog.enabled || state.phase === 'ended';
}

/**
 * Hexes `player` sees: those in the sight of its units on the field and of its camp. Terrain
 * and units block the view the same way they block shooting. With the fog lifted it is the
 * whole map.
 */
export function playerSight(state: BattleState, defs: BattleDefs, player: PlayerSlot): Set<HexKey> {
  if (isFogLifted(state, defs)) return new Set(Object.keys(defs.map.hexes) as HexKey[]);

  const context: SightContext = {
    terrains: defs.terrains,
    units: unitHexes(fieldedUnits(state)),
  };
  const seen = new Set<HexKey>();
  const look = (from: Hex, sight: number) => {
    for (const target of visibleHexes(defs.map, from, sight, context)) seen.add(hexKey(target));
  };
  for (const unit of fieldedUnits(state, player)) look(unit.pos, unitTypeOf(defs, unit).sight);
  const camp = defs.camps[player];
  if (camp) look(camp, defs.rules.fog.campSight);
  return seen;
}

/**
 * Whether `player` knows where the unit is. `sight` is `playerSight` of the same state, passed
 * in when many units are asked about. While the armies deploy, the enemy's stay hidden
 * wherever they stand.
 */
export function seesUnit(
  state: BattleState,
  defs: BattleDefs,
  player: PlayerSlot,
  unit: Unit,
  sight: ReadonlySet<HexKey> = playerSight(state, defs, player)
): boolean {
  if (unit.owner === player || isFogLifted(state, defs)) return true;
  return state.phase !== 'deployment' && isFielded(unit) && sight.has(hexKey(unit.pos));
}

/** The battle as `player` knows it; what an AI or a remote player is given instead of the state. */
export function playerView(state: BattleState, defs: BattleDefs, player: PlayerSlot): PlayerView {
  const visible = playerSight(state, defs, player);
  if (isFogLifted(state, defs)) return { player, state, visible };

  const units: Record<string, Unit> = {};
  for (const unit of Object.values(state.units)) {
    // Losses are no secret; only where the enemy stands, and what waits in its reserve, is.
    const gone = unit.status === 'dead' || unit.status === 'fled';
    if (gone || seesUnit(state, defs, player, unit, visible)) units[unit.id] = unit;
  }
  return { player, state: { ...state, units, rng: HIDDEN_RNG }, visible };
}

/**
 * The events of one command that `player` witnessed. `before` and `after` are the states
 * around the command. An enemy's march is cut to the part that passed through the player's
 * sight.
 */
export function eventsSeenBy(
  events: readonly GameEvent[],
  before: BattleState,
  after: BattleState,
  defs: BattleDefs,
  player: PlayerSlot
): GameEvent[] {
  if (isFogLifted(after, defs)) return [...events];

  const sightBefore = playerSight(before, defs, player);
  const sightAfter = playerSight(after, defs, player);
  const sawUnit = (unitId: string): boolean =>
    [[before, sightBefore] as const, [after, sightAfter] as const].some(([state, sight]) => {
      const unit = state.units[unitId];
      return !!unit && seesUnit(state, defs, player, unit, sight);
    });
  const sawHex = (target: Hex): boolean =>
    sightBefore.has(hexKey(target)) || sightAfter.has(hexKey(target));
  const isOwn = (unitId: string): boolean => after.units[unitId]?.owner === player;

  const seen: GameEvent[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'DeploymentEnded':
      case 'PhaseChanged':
      case 'TurnEnded':
      case 'TurnStarted':
      case 'BattleEnded':
        seen.push(event);
        break;
      case 'UnitMoved':
      case 'UnitRetreated': {
        if (isOwn(event.unitId)) {
          seen.push(event);
          break;
        }
        if (before.phase === 'deployment') break;
        const inSight = event.path.flatMap((step, index) => (sawHex(step) ? [index] : []));
        if (inSight.length === 0) break;
        seen.push({ ...event, path: event.path.slice(inSight[0], inSight.at(-1)! + 1) });
        break;
      }
      case 'AttackResolved':
        // A hit from the dark is still felt; who struck is plain from the blow.
        if (sawUnit(event.attackerId) || sawUnit(event.targetId)) seen.push(event);
        break;
      case 'UnitsSwapped':
        if (sawUnit(event.unitId) || sawUnit(event.targetId)) seen.push(event);
        break;
      default:
        if (sawUnit(event.unitId)) seen.push(event);
    }
  }
  return seen;
}
