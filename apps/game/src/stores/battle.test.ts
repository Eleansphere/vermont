import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { FieldedUnit, Hex } from '@vermont/core';
import {
  attackTargets,
  deploymentHexes,
  fieldedUnits,
  hexDistance,
  hexEquals,
  opponentOf,
  pathFromReach,
  reserveUnits,
  unitReach,
} from '@vermont/core';
import type { StartOptions } from './battle';
import { useBattleStore } from './battle';

const SEED = 7;
const MAX_TURNS_TO_CONTACT = 40;

type BattleStore = ReturnType<typeof useBattleStore>;

/** A battle with both armies already on the field. */
function startedStore(options: StartOptions = {}): BattleStore {
  const store = useBattleStore();
  store.start(SEED, 'trebia', { deployment: 'auto', ...options });
  return store;
}

/** Enemy units the player at the screen knows about. */
function sighted(store: BattleStore): FieldedUnit[] {
  return fieldedUnits(store.known!, opponentOf(store.viewer));
}

/** A battle the players still have to deploy for. */
function deployingStore(): BattleStore {
  const store = useBattleStore();
  store.start(SEED);
  return store;
}

/** A unit of the active player that can move, and a hex it can move to. */
function movableUnit(store: BattleStore): { unit: FieldedUnit; goal: Hex } {
  for (const unit of fieldedUnits(store.state!, store.state!.activePlayer)) {
    const reach = unitReach(store.state!, store.defs!, unit);
    const goal = [...reach.values()].find((node) => node.canStop && node.cost > 0);
    if (goal) return { unit, goal: goal.hex };
  }
  throw new Error('No unit can move');
}

function fielded(store: BattleStore, unitId: string): FieldedUnit {
  return store.state!.units[unitId] as FieldedUnit;
}

function moveTo(store: BattleStore, unit: FieldedUnit, goal: Hex): void {
  const reach = unitReach(store.state!, store.defs!, unit);
  store.send({ type: 'MoveUnit', unitId: unit.id, path: pathFromReach(reach, goal)!.hexes });
}

/** Marches both armies at each other until a unit of the player on turn has somebody to attack. */
function playUntilContact(store: BattleStore): FieldedUnit {
  for (let turn = 0; turn < MAX_TURNS_TO_CONTACT; turn++) {
    const player = store.state!.activePlayer;
    for (const { id } of fieldedUnits(store.state!, player)) {
      const unit = fielded(store, id);
      if (attackTargets(store.state!, store.defs!, unit).length > 0) return unit;

      const enemies = fieldedUnits(store.state!, opponentOf(player));
      const gap = (from: Hex) => Math.min(...enemies.map((enemy) => hexDistance(from, enemy.pos)));
      const stops = [...unitReach(store.state!, store.defs!, unit).values()].filter(
        (node) => node.canStop && node.cost > 0
      );
      const closest = stops.sort((a, b) => gap(a.hex) - gap(b.hex))[0];
      if (!closest || gap(closest.hex) >= gap(unit.pos)) continue;

      moveTo(store, unit, closest.hex);
      if (attackTargets(store.state!, store.defs!, fielded(store, id)).length > 0) {
        return fielded(store, id);
      }
    }
    store.endTurn();
  }
  throw new Error('The armies never met');
}

describe('battle store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  describe('starting', () => {
    it('starts the scenario with both armies on the field when asked to deploy them', () => {
      const store = startedStore();

      expect(store.scenario?.id).toBe('trebia');
      expect(store.state?.phase).toBe('battle');
      expect(fieldedUnits(store.state!, 0)).toHaveLength(12);
      expect(fieldedUnits(store.state!, 1)).toHaveLength(12);
      expect(store.played).toBeNull();
      expect(store.canUndo).toBe(false);
    });

    it('leaves the deployment to the players by default', () => {
      const store = deployingStore();

      expect(store.state?.phase).toBe('deployment');
      expect(store.reserve).toHaveLength(12);
      expect(store.selectedUnitId).toBe(store.reserve[0]!.id);
    });

    it('refuses a scenario that does not exist', () => {
      expect(() => useBattleStore().start(SEED, 'constructor')).toThrow('Unknown scenario');
    });

    it('starts the same scenario again', () => {
      const store = startedStore();
      store.endTurn();

      store.restart(SEED + 1);

      expect(store.state?.activePlayer).toBe(0);
      expect(store.state?.phase).toBe('battle');
      expect(store.state?.rng.seed).toBe(SEED + 1);
    });

    it('forgets the battle when it is left', () => {
      const store = startedStore();

      store.leave();

      expect(store.state).toBeNull();
      expect(store.log).toEqual([]);
    });
  });

  describe('deployment', () => {
    it('marks the hexes the selected unit can be put on', () => {
      const store = deployingStore();
      const unit = store.selectedUnit!;

      expect(store.highlights.selected).toBeNull();
      expect(store.highlights.reach).toEqual(deploymentHexes(store.state!, store.defs!, unit));
    });

    it('marks the whole zone while no unit is selected', () => {
      const store = deployingStore();

      store.select(null);

      expect(store.highlights.reach).toEqual(store.defs!.deploymentZones[0]);
    });

    it('deploys the selected unit on a clicked hex and picks the next one', () => {
      const store = deployingStore();
      const [first, second] = store.reserve;
      const target = store.highlights.reach![0]!;

      store.pick({ hex: target });

      expect(store.state!.units[first!.id]!.pos).toEqual(target);
      expect(store.reserve).toHaveLength(11);
      expect(store.selectedUnitId).toBe(second!.id);
      expect(store.played?.events.map((event) => event.type)).toEqual(['UnitDeployed']);
    });

    it('ignores a click outside the zone and keeps the selection', () => {
      const store = deployingStore();
      const selected = store.selectedUnitId;
      const outside = store.defs!.deploymentZones[1]![0]!;

      store.pick({ hex: outside });

      expect(store.reserve).toHaveLength(12);
      expect(store.selectedUnitId).toBe(selected);
    });

    it('moves a unit that already stands in the zone', () => {
      const store = deployingStore();
      const unitId = store.selectedUnitId!;
      const [from, to] = store.highlights.reach!;
      store.pick({ hex: from! });

      store.pick({ hex: from!, unitId });
      expect(store.selectedUnitId).toBe(unitId);
      expect(store.highlights.selected).toEqual(from);

      store.pick({ hex: to! });

      expect(store.state!.units[unitId]!.pos).toEqual(to);
      expect(store.selectedUnitId).toBeNull();
    });

    it('takes a deployment back', () => {
      const store = deployingStore();
      const unitId = store.selectedUnitId!;
      store.pick({ hex: store.highlights.reach![0]! });

      expect(store.undo()).toBe(true);

      expect(store.state!.units[unitId]!.status).toBe('reserve');
      expect(store.selectedUnitId).toBe(unitId);
      expect(store.played).toMatchObject({ events: [], state: store.known });
      expect(store.canUndo).toBe(false);
    });

    it('deploys the rest of the army at once, as one step to take back', () => {
      const store = deployingStore();
      store.pick({ hex: store.highlights.reach![0]! });

      store.autoDeploy();
      expect(store.reserve).toHaveLength(0);

      store.undo();
      expect(store.reserve).toHaveLength(11);
    });

    it('does not end the deployment while units wait in reserve', () => {
      const store = deployingStore();

      store.endDeployment();

      expect(store.state?.activePlayer).toBe(0);
      expect(store.rejection?.code).toBe('unitsNotDeployed');
    });

    it('hands the deployment to the other player and then starts the battle', () => {
      const store = deployingStore();

      store.autoDeploy();
      store.endDeployment();

      expect(store.state?.phase).toBe('deployment');
      expect(store.state?.activePlayer).toBe(1);
      expect(store.canUndo).toBe(false);
      expect(store.selectedUnitId).toBe(reserveUnits(store.state!, 1)[0]!.id);

      store.autoDeploy();
      store.endDeployment();

      expect(store.state?.phase).toBe('battle');
      expect(store.selectedUnitId).toBeNull();
      expect(store.log.map((entry) => entry.text)).toEqual([
        'Řím: rozestavení dokončeno.',
        'Kartágo: rozestavení dokončeno.',
        'Bitva začíná.',
        'Kolo 1, na tahu Řím.',
      ]);
    });

    it('walks through the units in reserve', () => {
      const store = deployingStore();
      const ids = store.reserve.map((unit) => unit.id);

      store.selectNext();
      expect(store.selectedUnitId).toBe(ids[1]);

      store.selectNext(-1);
      store.selectNext(-1);
      expect(store.selectedUnitId).toBe(ids.at(-1));
    });
  });

  describe('battle', () => {
    it('selects a unit of the active player and marks where it can go', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);

      store.pick({ hex: unit.pos, unitId: unit.id });

      expect(store.selectedUnitId).toBe(unit.id);
      expect(store.highlights.selected).toEqual(unit.pos);
      expect(store.highlights.reach?.some((reachable) => hexEquals(reachable, goal))).toBe(true);
      expect(store.highlights.reach?.some((reachable) => hexEquals(reachable, unit.pos))).toBe(
        false
      );
    });

    it('does not select a unit of the other player', () => {
      const store = startedStore();
      const enemy = fieldedUnits(store.state!, 1)[0]!;

      store.pick({ hex: enemy.pos, unitId: enemy.id });

      expect(store.selectedUnitId).toBeNull();
    });

    it('shows the route to the hex under the pointer', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);
      store.pick({ hex: unit.pos, unitId: unit.id });

      store.hover(goal);

      const path = pathFromReach(unitReach(store.state!, store.defs!, unit), goal)!;
      expect(store.highlights.path).toEqual(path.hexes.slice(1));

      store.hover(null);
      expect(store.highlights.path).toEqual([]);
    });

    it('moves the selected unit to a clicked hex and hands the events to the renderer', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);
      store.pick({ hex: unit.pos, unitId: unit.id });

      store.pick({ hex: goal });

      expect(store.state!.units[unit.id]!.pos).toEqual(goal);
      expect(store.played?.events.map((event) => event.type)).toContain('UnitMoved');
      expect(store.played?.state).toEqual(store.known);
      expect(store.selectedUnitId).toBe(unit.id);
      expect(store.highlights.selected).toEqual(goal);
    });

    it('drops the selection on a click it cannot act on', () => {
      const store = startedStore();
      const { unit } = movableUnit(store);
      const before = store.state;
      store.pick({ hex: unit.pos, unitId: unit.id });

      store.pick(null);

      expect(store.selectedUnitId).toBeNull();
      expect(store.state).toBe(before);
      expect(store.highlights.reach).toEqual([]);
    });

    it('ends the turn and clears the selection', () => {
      const store = startedStore();
      const { unit } = movableUnit(store);
      store.pick({ hex: unit.pos, unitId: unit.id });

      store.endTurn();

      expect(store.state?.activePlayer).toBe(1);
      expect(store.selectedUnitId).toBeNull();
      expect(store.played?.events.map((event) => event.type)).toContain('TurnStarted');
    });

    it('keeps the state and remembers why a command was refused', () => {
      const store = startedStore();
      const before = store.state;

      expect(store.send({ type: 'EndDeployment' })).toBe(false);

      expect(store.state).toBe(before);
      expect(store.rejection?.code).toBe('wrongPhase');
    });

    it('lists the units that can still act and walks through them', () => {
      const store = startedStore();
      const ready = store.readyUnits.map((unit) => unit.id);
      expect(ready).toHaveLength(12);

      store.selectNext();
      expect(store.selectedUnitId).toBe(ready[0]);
      store.selectNext();
      expect(store.selectedUnitId).toBe(ready[1]);
      store.selectNext(-1);
      store.selectNext(-1);
      expect(store.selectedUnitId).toBe(ready.at(-1));
    });

    it('describes the hex under the pointer', () => {
      const store = startedStore({ fog: false });
      const unit = fieldedUnits(store.state!, 1)[0]!;

      store.hover(unit.pos);
      expect(store.hoverInfo).toMatchObject({ hex: unit.pos, unit, preview: null, campOf: null });

      store.hover(store.defs!.camps[1]!);
      expect(store.hoverInfo).toMatchObject({ terrain: { id: 'camp' }, campOf: 1 });

      store.hover(null);
      expect(store.hoverInfo).toBeNull();
    });
  });

  describe('undo', () => {
    it('takes a move back, with its line of the log', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);
      const before = store.state;
      const logBefore = store.log;
      store.pick({ hex: unit.pos, unitId: unit.id });
      store.pick({ hex: goal });
      expect(store.canUndo).toBe(true);
      expect(store.log).toHaveLength(logBefore.length + 1);

      expect(store.undo()).toBe(true);

      expect(store.state).toBe(before);
      expect(store.log).toEqual(logBefore);
      expect(store.played).toMatchObject({ events: [], state: store.known });
      expect(store.selectedUnitId).toBe(unit.id);
      expect(store.canUndo).toBe(false);
    });

    it('takes several moves back one by one', () => {
      const store = startedStore();
      const start = store.state;
      for (let moves = 0; moves < 2; moves++) {
        const { unit, goal } = movableUnit(store);
        moveTo(store, unit, goal);
      }

      store.undo();
      store.undo();

      expect(store.state).toBe(start);
      expect(store.undo()).toBe(false);
    });

    it('cannot reach back past the end of a turn', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);
      store.pick({ hex: unit.pos, unitId: unit.id });
      store.pick({ hex: goal });

      store.endTurn();

      expect(store.canUndo).toBe(false);
      expect(store.undo()).toBe(false);
      expect(store.state?.activePlayer).toBe(1);
    });

    it('cannot take back an attack, nor the moves made before it', () => {
      const store = startedStore();
      const attacker = playUntilContact(store);
      const other = fieldedUnits(store.state!, attacker.owner).find((unit) => {
        if (unit.id === attacker.id) return false;
        const reach = unitReach(store.state!, store.defs!, unit);
        return [...reach.values()].some((node) => node.canStop && node.cost > 0);
      })!;
      const reach = unitReach(store.state!, store.defs!, other);
      // One step back, so the attacker still has its target afterwards.
      const retreat = [...reach.values()]
        .filter((node) => node.canStop && node.cost > 0)
        .sort((a, b) => a.cost - b.cost)[0]!;
      moveTo(store, other, retreat.hex);
      expect(store.canUndo).toBe(true);
      const target = attackTargets(store.state!, store.defs!, fielded(store, attacker.id))[0]!;

      store.pick({ hex: attacker.pos, unitId: attacker.id });
      store.hover(target.pos);
      expect(store.hoverInfo?.preview?.damage.min).toBeGreaterThan(0);
      expect(store.highlights.targets).toContainEqual(target.pos);
      store.pick({ hex: target.pos, unitId: target.id });

      expect(store.played?.events[0]?.type).toBe('AttackResolved');
      expect(store.canUndo).toBe(false);
      expect(store.log.some((entry) => entry.tone === 'combat')).toBe(true);
    });
  });

  describe('fog of war', () => {
    it('shows a player their own army and none of the enemy they cannot see', () => {
      const store = startedStore();

      expect(fieldedUnits(store.known!, 0)).toHaveLength(12);
      expect(sighted(store)).toEqual([]);
      expect(store.shown?.visible?.size).toBeLessThan(Object.keys(store.defs!.map.hexes).length);
    });

    it('says that a hex lies out of sight', () => {
      const store = startedStore();
      const enemy = fieldedUnits(store.state!, 1)[0]!;

      store.hover(enemy.pos);
      expect(store.hoverInfo).toMatchObject({ unit: null, fogged: true });

      store.hover(fieldedUnits(store.state!, 0)[0]!.pos);
      expect(store.hoverInfo).toMatchObject({ fogged: false });
    });

    it('covers the map between the turns until the next player sits down', () => {
      const store = startedStore();
      const { unit } = movableUnit(store);
      expect(store.handover).toBeNull();

      store.endTurn();

      expect(store.viewer).toBe(1);
      expect(store.handover).toBe(1);
      expect(fieldedUnits(store.known!, 1)).toHaveLength(12);
      expect(fieldedUnits(store.played!.from!.state, 0)).toEqual([]);
      expect(sighted(store)).toEqual([]);

      const own = fieldedUnits(store.known!, 1)[0]!;
      store.pick({ hex: own.pos, unitId: own.id });
      expect(store.selectedUnitId).toBeNull();
      expect(unit.owner).toBe(0);

      store.takeSeat();
      store.pick({ hex: own.pos, unitId: own.id });

      expect(store.handover).toBeNull();
      expect(store.selectedUnitId).toBe(own.id);
    });

    it('keeps a log for each player of what that player witnessed', () => {
      const store = startedStore();
      const { unit, goal } = movableUnit(store);
      moveTo(store, unit, goal);
      expect(store.log.some((entry) => entry.tone === 'move')).toBe(true);

      store.endTurn();

      expect(store.log.some((entry) => entry.tone === 'move')).toBe(false);
      expect(store.log.at(-1)?.text).toBe('Kolo 1, na tahu Kartágo.');
    });

    it('hides how the first player deployed from the second', () => {
      const store = deployingStore();
      store.autoDeploy();

      store.endDeployment();

      expect(store.handover).toBe(1);
      expect(fieldedUnits(store.state!, 0)).toHaveLength(12);
      expect(fieldedUnits(store.known!)).toEqual([]);
      expect(store.reserve).toHaveLength(12);
    });

    it('does not take back a move that brought an enemy into sight', () => {
      const store = startedStore();
      let sightings = 0;
      for (let turn = 0; turn < MAX_TURNS_TO_CONTACT && sightings === 0; turn++) {
        const player = store.state!.activePlayer;
        const enemies = fieldedUnits(store.state!, opponentOf(player));
        const gap = (from: Hex) =>
          Math.min(...enemies.map((enemy) => hexDistance(from, enemy.pos)));
        for (const { id } of fieldedUnits(store.known!, player)) {
          const reach = unitReach(store.known!, store.defs!, fielded(store, id));
          const closest = [...reach.values()]
            .filter((node) => node.canStop && node.cost > 0)
            .sort((a, b) => gap(a.hex) - gap(b.hex))[0];
          if (!closest) continue;
          const known = sighted(store).length;

          moveTo(store, fielded(store, id), closest.hex);

          const learned = sighted(store).length > known;
          expect(store.canUndo).toBe(!learned);
          if (learned) sightings++;
        }
        store.endTurn();
        store.takeSeat();
      }

      expect(sightings).toBeGreaterThan(0);
    });

    it('shows everything and asks for no change of seats with the fog off', () => {
      const store = startedStore({ fog: false });

      expect(store.known).toBe(store.state);
      expect(store.shown?.visible).toBeNull();

      store.endTurn();

      expect(store.viewer).toBe(1);
      expect(store.handover).toBeNull();
    });

    it('lifts the fog when the battle is over', () => {
      const store = startedStore();

      store.state = {
        ...store.state!,
        phase: 'ended',
        winner: { player: 0, reason: 'armyBroken' },
      };

      expect(store.shown?.visible).toBeNull();
      expect(sighted(store)).toHaveLength(12);
    });
  });

  describe('line relief', () => {
    function withPrincipes(): { store: BattleStore; unit: FieldedUnit } {
      const store = startedStore();
      const unit = fielded(store, 'p0-principes-1');
      store.pick({ hex: unit.pos, unitId: unit.id });
      return { store, unit };
    }

    it('offers the neighbours the unit can change places with', () => {
      const { store, unit } = withPrincipes();

      expect(store.reliefPartners.length).toBeGreaterThan(0);
      for (const partner of store.reliefPartners) {
        expect(partner.owner).toBe(0);
        expect(hexDistance(partner.pos, unit.pos)).toBe(1);
      }

      store.toggleRelief();

      expect(store.order).toBe('relief');
      expect(store.highlights.reach).toEqual(store.reliefPartners.map((partner) => partner.pos));
      expect(store.highlights.targets).toEqual([]);
    });

    it('swaps the two units on a click, for good', () => {
      const { store, unit } = withPrincipes();
      const partner = store.reliefPartners[0]!;
      store.toggleRelief();

      store.pick({ hex: partner.pos, unitId: partner.id });

      expect(fielded(store, unit.id).pos).toEqual(partner.pos);
      expect(fielded(store, partner.id).pos).toEqual(unit.pos);
      expect(store.order).toBe('move');
      expect(store.canUndo).toBe(false);
    });

    it('goes back to moving when the click is not on a partner', () => {
      const { store, unit } = withPrincipes();
      store.toggleRelief();

      store.pick(null);

      expect(store.order).toBe('move');
      expect(fielded(store, unit.id).pos).toEqual(unit.pos);
    });

    it('is not offered to a unit without the ability', () => {
      const store = startedStore();
      const unit = fielded(store, 'p0-hastati-1');
      store.pick({ hex: unit.pos, unitId: unit.id });

      store.toggleRelief();

      expect(store.reliefPartners).toEqual([]);
      expect(store.order).toBe('move');
    });
  });
});
