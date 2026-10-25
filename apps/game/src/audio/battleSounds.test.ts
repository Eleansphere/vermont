import { describe, expect, it } from 'vitest';
import type { Archetype, BattleState, GameEvent, PlayerSlot } from '@vermont/core';
import { SCENARIOS, autoDeployment, dispatchAll, fieldedUnits, startScenario } from '@vermont/core';
import type { AnimationCue, CueKind } from '@vermont/render';
import { SoundLimiter, cueSounds, tumultLevel } from './battleSounds';

const STRIKE: GameEvent = {
  type: 'AttackResolved',
  attackerId: 'a',
  targetId: 'b',
  kind: 'melee',
  damage: 1,
  counterDamage: null,
};

function cue(
  kind: CueKind,
  archetype?: Archetype,
  event: GameEvent = STRIKE,
  pan = 0
): AnimationCue {
  return { kind, event, pan, ...(archetype && { unit: { archetype, owner: 0 } }) };
}

const soundsOf = (played: AnimationCue, listener: PlayerSlot | null = null) =>
  cueSounds(played, listener).map((request) => request.sound);

describe('battle sounds', () => {
  it('marches infantry on foot and cavalry at a trot', () => {
    expect(soundsOf(cue('step', 'heavyInfantry'))).toEqual(['step']);
    expect(soundsOf(cue('march', 'heavyInfantry'))).toEqual([]);
    expect(soundsOf(cue('march', 'cavalry'))).toEqual(['trot']);
    expect(soundsOf(cue('step', 'lightCavalry'))).toEqual([]);
    expect(soundsOf(cue('step', 'elephant'))).toEqual(['stomp']);
  });

  it('clashes in melee, with a charge for horsemen', () => {
    expect(soundsOf(cue('strike', 'spear'))).toEqual(['clash']);
    expect(soundsOf(cue('strike', 'cavalry'))).toEqual(['charge', 'clash']);
    expect(soundsOf(cue('rampage', 'elephant'))).toEqual(['trumpet', 'stomp']);
  });

  it('follows the action across the screen, but not all the way', () => {
    const [left] = cueSounds(cue('strike', 'spear', STRIKE, -1), null);
    const [right] = cueSounds(cue('strike', 'spear', STRIKE, 1), null);

    expect(left!.pan).toBeLessThan(-0.3);
    expect(right!.pan).toBeGreaterThan(0.3);
    expect(Math.abs(right!.pan)).toBeLessThan(1);
  });

  it("blows each side's horn at the start of its turn", () => {
    expect(soundsOf(cue('turn', undefined, { type: 'TurnStarted', player: 0, turn: 2 }))).toEqual([
      'horn0',
    ]);
    expect(soundsOf(cue('turn', undefined, { type: 'TurnStarted', player: 1, turn: 2 }))).toEqual([
      'horn1',
    ]);
  });

  it('ends with the victory or the defeat of the player against the computer', () => {
    const ended = cue('end', undefined, { type: 'BattleEnded', winner: 1, reason: 'armyBroken' });

    expect(soundsOf(ended, 1)).toEqual(['victory']);
    expect(soundsOf(ended, 0)).toEqual(['defeat']);
    // Two players at one screen: somebody won.
    expect(soundsOf(ended, null)).toEqual(['victory']);
    expect(soundsOf(cue('end', undefined, { type: 'BattleDrawn' }), 0)).toEqual(['draw']);
  });
});

describe('tumult', () => {
  function deployed(): BattleState {
    const { state: start, defs } = startScenario(SCENARIOS.trebia!, 1);
    let state = start;
    while (state.phase === 'deployment') {
      const result = dispatchAll(
        state,
        [...autoDeployment(state, defs), { type: 'EndDeployment' }],
        defs
      );
      if (!result.ok) throw new Error(result.rejection.message);
      state = result.state;
    }
    return state;
  }

  it('is silent while the armies stand apart', () => {
    expect(tumultLevel(deployed())).toBe(0);
  });

  it('grows as units come to blows', () => {
    const state = deployed();
    const roman = fieldedUnits(state, 0)[0]!;
    const enemy = fieldedUnits(state, 1)[0]!;
    const touching: BattleState = {
      ...state,
      units: {
        ...state.units,
        [enemy.id]: { ...enemy, pos: { q: roman.pos.q + 1, r: roman.pos.r } },
      },
    };

    expect(tumultLevel(touching)).toBeGreaterThan(0);
    expect(tumultLevel(touching)).toBeLessThanOrEqual(1);
  });
});

describe('sound limiter', () => {
  it('lets a sound through only so often', () => {
    const limiter = new SoundLimiter(2, 0.3);

    expect(limiter.allow('clash', 0)).toBe(true);
    expect(limiter.allow('clash', 0.1)).toBe(true);
    expect(limiter.allow('clash', 0.2)).toBe(false);
    expect(limiter.allow('fall', 0.2)).toBe(true);
    expect(limiter.allow('clash', 0.45)).toBe(true);
  });
});
