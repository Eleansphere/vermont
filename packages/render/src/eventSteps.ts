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
/** Long enough for a figure's fall; placeholders tip over meanwhile. */
const DEATH_SECONDS = 0.9;
/** Share of a death the fallen figures lie still before they sink away. */
const DEATH_LIE = 0.6;
const FLEE_SECONDS = 0.35;
const SWAP_SECONDS = 0.3;
const DEPLOY_START_SCALE = 0.6;
const DAMAGE_TEXT_COLOR = '#ff7a6b';

/**
 * A moment of an animation that something outside the renderer may want to follow, such as a
 * sound: a blow lands, a missile hits, a unit falls.
 */
export type CueKind =
  | 'march'
  | 'step'
  | 'strike'
  | 'shoot'
  | 'land'
  | 'rampage'
  | 'hurt'
  | 'death'
  | 'flee'
  | 'rally'
  | 'ambush'
  | 'turn'
  | 'end';

export interface StepContext {
  readonly units: UnitLayer;
  /** The state after the events; tells what the units that appear are. */
  readonly state: BattleState;
  /** Where short-lived things such as missiles are put. */
  readonly effects: Object3D;
  /** Told when a cue of the animation comes, with the unit it is about, if any. */
  cue?(kind: CueKind, event: GameEvent, view?: UnitView): void;
}

/**
 * The animation of one event. Steps look the units up when they begin, not when they are
 * queued, because the steps before them move and remove units.
 */
export function eventSteps(event: GameEvent, context: StepContext): Step[] {
  const { units } = context;
  const cue: Cue = (kind, view) => context.cue?.(kind, event, view);
  switch (event.type) {
    case 'UnitDeployed':
      return [deploy(event.unitId, event.hex, context)];
    case 'UnitMoved':
    case 'UnitRetreated':
      return walk(event.unitId, event.path, units, cue);
    case 'UnitsSwapped':
      return [swap(event.unitId, event.targetId, units)];
    case 'AttackResolved': {
      const steps =
        event.kind === 'melee'
          ? [lunge(event.attackerId, event.targetId, units, cue, 'strike')]
          : [shot(event.attackerId, event.targetId, context, cue)];
      if (event.counterDamage !== null)
        steps.push(lunge(event.targetId, event.attackerId, units, cue, 'strike'));
      return steps;
    }
    case 'UnitRampaged':
      return [lunge(event.unitId, event.targetId, units, cue, 'rampage')];
    case 'UnitDamaged':
      return [hit(event.unitId, event.hp, event.damage, units, cue)];
    case 'UnitDied':
      return [die(event.unitId, units, cue)];
    case 'UnitFled':
      return [flee(event.unitId, units, cue)];
    case 'MoraleChanged':
      return [
        {
          duration: 0,
          begin: () => units.setMorale(event.unitId, event.moraleState, event.morale),
        },
      ];
    case 'UnitRallied':
      return [unitCue('rally', event.unitId, units, cue)];
    case 'UnitAmbushed':
      return [unitCue('ambush', event.unitId, units, cue)];
    case 'TurnStarted':
      return [{ duration: 0, begin: () => cue('turn') }];
    case 'BattleEnded':
    case 'BattleDrawn':
      return [{ duration: 0, begin: () => cue('end') }];
    default:
      return [];
  }
}

type Cue = (kind: CueKind, view?: UnitView) => void;

/** Only tells that something happened to the unit; the scene shows it otherwise. */
function unitCue(kind: CueKind, unitId: string, units: UnitLayer, cue: Cue): Step {
  return { duration: 0, begin: () => cue(kind, units.view(unitId)) };
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

function walk(unitId: string, path: readonly Hex[], units: UnitLayer, cue: Cue): Step[] {
  const steps = path.slice(1);
  return steps.map((target, index) => {
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
        if (index === 0) {
          units.pose(view, 'walk');
          cue('march', view);
        }
        cue('step', view);
      },
      update(progress) {
        view?.object.position.lerpVectors(from, to, progress);
      },
      end() {
        if (!view) return;
        units.place(view, target);
        if (index === steps.length - 1) units.pose(view, 'idle');
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

/** The striker leans towards its target and back; the blow lands at the furthest lean. */
function lunge(
  strikerId: string,
  targetId: string,
  units: UnitLayer,
  cue: Cue,
  kind: CueKind
): Step {
  let striker: UnitView | undefined;
  let landed = false;
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
      units.pose(striker, 'attack');
    },
    update(progress) {
      if (!striker) return;
      striker.object.position.copy(home).addScaledVector(reach, Math.sin(Math.PI * progress));
      if (!landed && progress >= 0.5) {
        landed = true;
        cue(kind, striker);
      }
    },
    end() {
      striker?.object.position.copy(home);
    },
  };
}

/** A missile flies in an arc from the shooter to its target. */
function shot(
  shooterId: string,
  targetId: string,
  { units, effects }: StepContext,
  cue: Cue
): Step {
  let missile: Mesh<SphereGeometry, MeshBasicMaterial> | undefined;
  let target: UnitView | undefined;
  const from = new Vector3();
  const to = new Vector3();
  return {
    duration: SHOT_SECONDS,
    begin() {
      const shooter = units.view(shooterId);
      target = units.view(targetId);
      if (!shooter || !target) return;
      units.face(shooter, target.object.position);
      units.pose(shooter, 'shoot');
      cue('shoot', shooter);
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
      cue('land', target);
      effects.remove(missile);
      missile.geometry.dispose();
      missile.material.dispose();
    },
  };
}

/** The unit flashes and its health bar drops. */
function hit(unitId: string, hp: number, damage: number, units: UnitLayer, cue: Cue): Step {
  let view: UnitView | undefined;
  return {
    duration: HIT_SECONDS,
    begin() {
      view = units.view(unitId);
      units.setHealth(unitId, hp);
      if (!view) return;
      if (damage > 0) units.float(unitId, `−${damage}`, DAMAGE_TEXT_COLOR);
      units.pose(view, 'hit');
      cue('hurt', view);
    },
    update(progress) {
      if (view) units.setGlow(view, 1 - progress);
    },
  };
}

/** The figures fall, lie a moment and sink away; a placeholder tips over. */
function die(unitId: string, units: UnitLayer, cue: Cue): Step {
  let view: UnitView | undefined;
  let animated = false;
  return {
    duration: DEATH_SECONDS,
    begin() {
      view = units.view(unitId);
      if (!view) return;
      animated = units.animated(view);
      if (animated) units.pose(view, 'death');
      cue('death', view);
    },
    update(progress) {
      if (!view) return;
      if (!animated) view.model.rotation.z = (Math.PI / 2) * Math.min(1, progress / DEATH_LIE);
      const sinking = Math.max(0, (progress - DEATH_LIE) / (1 - DEATH_LIE));
      view.object.scale.setScalar(1 - sinking / 2);
    },
    end() {
      units.remove(unitId);
    },
  };
}

/** The unit shrinks away as it leaves the field. */
function flee(unitId: string, units: UnitLayer, cue: Cue): Step {
  let view: UnitView | undefined;
  return {
    duration: FLEE_SECONDS,
    begin() {
      view = units.view(unitId);
      if (!view) return;
      units.pose(view, 'walk');
      cue('flee', view);
    },
    update(progress) {
      view?.object.scale.setScalar(1 - progress);
    },
    end() {
      units.remove(unitId);
    },
  };
}
