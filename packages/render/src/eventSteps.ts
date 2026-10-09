import type { Object3D } from 'three';
import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three';
import type { BattleState, GameEvent, Hex } from '@vermont/core';
import type { Step } from './timeline';
import type { UnitLayer, UnitView } from './units';

/** Seconds a unit takes to walk from one hex to the next. */
const STEP_SECONDS = 0.16;
const DEPLOY_SECONDS = 0.12;
const LUNGE_SECONDS = 0.28;
/** How far towards its target a unit leans when it strikes, as a share of the way. */
const LUNGE_REACH = 0.35;
const SHOT_SECONDS = 0.35;
const SHOT_ARC_HEIGHT = 1.2;
const SHOT_START_HEIGHT = 0.7;
const SHOT_RADIUS = 0.09;
const SHOT_COLOR = 0x22252b;
const HIT_SECONDS = 0.22;
const DEATH_SECONDS = 0.45;
const FLEE_SECONDS = 0.35;
const SWAP_SECONDS = 0.3;
const DEPLOY_START_SCALE = 0.6;

export interface StepContext {
  readonly units: UnitLayer;
  /** The state after the events; tells what the units that appear are. */
  readonly state: BattleState;
  /** Where short-lived things such as missiles are put. */
  readonly effects: Object3D;
}

/**
 * The animation of one event. Steps look the units up when they begin, not when they are
 * queued, because the steps before them move and remove units.
 */
export function eventSteps(event: GameEvent, context: StepContext): Step[] {
  const { units } = context;
  switch (event.type) {
    case 'UnitDeployed':
      return [deploy(event.unitId, event.hex, context)];
    case 'UnitMoved':
    case 'UnitRetreated':
      return walk(event.unitId, event.path, units);
    case 'UnitsSwapped':
      return [swap(event.unitId, event.targetId, units)];
    case 'AttackResolved': {
      const strike = event.kind === 'melee' ? lunge : shot;
      const steps = [strike(event.attackerId, event.targetId, context)];
      if (event.counterDamage !== null)
        steps.push(lunge(event.targetId, event.attackerId, context));
      return steps;
    }
    case 'UnitDamaged':
      return [hit(event.unitId, event.hp, units)];
    case 'UnitDied':
      return [die(event.unitId, units)];
    case 'UnitFled':
      return [flee(event.unitId, units)];
    default:
      return [];
  }
}

function deploy(unitId: string, target: Hex, { units, state }: StepContext): Step {
  let view: UnitView | undefined;
  return {
    duration: DEPLOY_SECONDS,
    begin() {
      const unit = state.units[unitId];
      view = units.view(unitId) ?? (unit && units.add(unit, target));
      if (view) units.place(view, target);
    },
    update(progress) {
      view?.object.scale.setScalar(DEPLOY_START_SCALE + (1 - DEPLOY_START_SCALE) * progress);
    },
  };
}

function walk(unitId: string, path: readonly Hex[], units: UnitLayer): Step[] {
  return path.slice(1).map((target) => {
    let view: UnitView | undefined;
    const from = new Vector3();
    const to = new Vector3();
    return {
      duration: STEP_SECONDS,
      begin() {
        view = units.view(unitId);
        if (!view) return;
        from.copy(view.object.position);
        to.copy(units.standPoint(target));
        units.face(view, to);
      },
      update(progress) {
        view?.object.position.lerpVectors(from, to, progress);
      },
      end() {
        if (view) units.place(view, target);
      },
    };
  });
}

function swap(unitId: string, targetId: string, units: UnitLayer): Step {
  let pair: readonly [UnitView, UnitView] | undefined;
  let hexes: readonly [Hex, Hex] | undefined;
  const first = new Vector3();
  const second = new Vector3();
  return {
    duration: SWAP_SECONDS,
    begin() {
      const unit = units.view(unitId);
      const target = units.view(targetId);
      if (!unit || !target) return;
      pair = [unit, target];
      hexes = [unit.hex, target.hex];
      first.copy(unit.object.position);
      second.copy(target.object.position);
    },
    update(progress) {
      pair?.[0].object.position.lerpVectors(first, second, progress);
      pair?.[1].object.position.lerpVectors(second, first, progress);
    },
    end() {
      if (!pair || !hexes) return;
      units.place(pair[0], hexes[1]);
      units.place(pair[1], hexes[0]);
    },
  };
}

/** The striker leans towards its target and back. */
function lunge(strikerId: string, targetId: string, { units }: StepContext): Step {
  let striker: UnitView | undefined;
  const home = new Vector3();
  const reach = new Vector3();
  return {
    duration: LUNGE_SECONDS,
    begin() {
      striker = units.view(strikerId);
      const target = units.view(targetId);
      if (!striker || !target) {
        striker = undefined;
        return;
      }
      home.copy(striker.object.position);
      reach.copy(target.object.position).sub(home).multiplyScalar(LUNGE_REACH);
      units.face(striker, target.object.position);
    },
    update(progress) {
      striker?.object.position.copy(home).addScaledVector(reach, Math.sin(Math.PI * progress));
    },
    end() {
      striker?.object.position.copy(home);
    },
  };
}

/** A missile flies in an arc from the shooter to its target. */
function shot(shooterId: string, targetId: string, { units, effects }: StepContext): Step {
  let missile: Mesh<SphereGeometry, MeshBasicMaterial> | undefined;
  const from = new Vector3();
  const to = new Vector3();
  return {
    duration: SHOT_SECONDS,
    begin() {
      const shooter = units.view(shooterId);
      const target = units.view(targetId);
      if (!shooter || !target) return;
      units.face(shooter, target.object.position);
      from.copy(shooter.object.position).setY(shooter.object.position.y + SHOT_START_HEIGHT);
      to.copy(target.object.position).setY(target.object.position.y + SHOT_START_HEIGHT);
      missile = new Mesh(
        new SphereGeometry(SHOT_RADIUS, 8, 6),
        new MeshBasicMaterial({ color: SHOT_COLOR })
      );
      missile.position.copy(from);
      effects.add(missile);
    },
    update(progress) {
      if (!missile) return;
      missile.position.lerpVectors(from, to, progress);
      missile.position.y += SHOT_ARC_HEIGHT * Math.sin(Math.PI * progress);
    },
    end() {
      if (!missile) return;
      effects.remove(missile);
      missile.geometry.dispose();
      missile.material.dispose();
    },
  };
}

/** The unit flashes and its health bar drops. */
function hit(unitId: string, hp: number, units: UnitLayer): Step {
  let view: UnitView | undefined;
  return {
    duration: HIT_SECONDS,
    begin() {
      view = units.view(unitId);
      units.setHealth(unitId, hp);
    },
    update(progress) {
      if (view) units.setGlow(view, 1 - progress);
    },
  };
}

/** The unit falls over and sinks, then it is gone. */
function die(unitId: string, units: UnitLayer): Step {
  let view: UnitView | undefined;
  return {
    duration: DEATH_SECONDS,
    begin() {
      view = units.view(unitId);
    },
    update(progress) {
      if (!view) return;
      view.model.rotation.z = (Math.PI / 2) * progress;
      view.object.scale.setScalar(1 - progress / 2);
    },
    end() {
      units.remove(unitId);
    },
  };
}

/** The unit shrinks away as it leaves the field. */
function flee(unitId: string, units: UnitLayer): Step {
  let view: UnitView | undefined;
  return {
    duration: FLEE_SECONDS,
    begin() {
      view = units.view(unitId);
    },
    update(progress) {
      view?.object.scale.setScalar(1 - progress);
    },
    end() {
      units.remove(unitId);
    },
  };
}
