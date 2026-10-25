import type { Archetype, BattleState, PlayerSlot } from '@vermont/core';
import { adjacentUnits, fieldedUnits, isFighting, opponentOf } from '@vermont/core';
import type { AnimationCue } from '@vermont/render';
import type { SoundId } from './sounds';

/** A sound to play for a moment of the battle. */
export interface SoundRequest {
  readonly sound: SoundId;
  /** From -1 (left) to 1 (right). */
  readonly pan: number;
  /** Speed of playback; below 1 deepens the sound. */
  readonly rate?: number;
}

const MOUNTED: readonly Archetype[] = ['cavalry', 'lightCavalry'];
/** How far the sounds follow the action across the screen; all the way would be too much. */
const PAN_WIDTH = 0.6;
/** Units in combat at which the tumult of the battle is at its loudest. */
const FULL_TUMULT = 10;

/**
 * What the player hears when the animation reaches a cue. `listener` is the side of the player
 * at the screen against the computer; `null` when two players share the screen.
 */
export function cueSounds(cue: AnimationCue, listener: PlayerSlot | null): SoundRequest[] {
  const pan = cue.pan * PAN_WIDTH;
  const archetype = cue.unit?.archetype;
  const mounted = archetype !== undefined && MOUNTED.includes(archetype);
  const elephant = archetype === 'elephant';
  const sounds = (...ids: SoundId[]) => ids.map((sound) => ({ sound, pan }));

  switch (cue.kind) {
    case 'march':
      return mounted ? sounds('trot') : [];
    case 'step':
      if (elephant) return [{ sound: 'stomp', pan, rate: 0.8 }];
      return mounted ? [] : sounds('step');
    case 'strike':
      if (elephant) return sounds('stomp', 'clash');
      return mounted ? sounds('charge', 'clash') : sounds('clash');
    case 'shoot':
      return sounds('throw');
    case 'land':
      return sounds('land');
    case 'rampage':
      return sounds('trumpet', 'stomp');
    case 'hurt':
      return elephant ? sounds('trumpet') : sounds('hurt');
    case 'death':
      return sounds('fall');
    case 'flee':
      return sounds('rout');
    case 'rally':
      return sounds('rally');
    case 'ambush':
      return sounds('ambush');
    case 'turn':
      return cue.event.type === 'TurnStarted'
        ? [{ sound: cue.event.player === 0 ? 'horn0' : 'horn1', pan: 0 }]
        : [];
    case 'end':
      return [{ sound: endSound(cue, listener), pan: 0 }];
  }
}

/** Two players at one screen both hear the victory; against the computer it is the player's. */
function endSound(cue: AnimationCue, listener: PlayerSlot | null): SoundId {
  if (cue.event.type !== 'BattleEnded') return 'draw';
  return listener === null || cue.event.winner === listener ? 'victory' : 'defeat';
}

/**
 * How loud the tumult of the battle is, from 0 to 1: how many of the units the player sees
 * stand next to an enemy. Every fight has one of the player's units in it, so what the player
 * sees is all the fighting there is.
 */
export function tumultLevel(shown: BattleState): number {
  let fighting = 0;
  for (const unit of fieldedUnits(shown)) {
    if (adjacentUnits(shown, unit.pos, opponentOf(unit.owner)).some(isFighting)) fighting++;
  }
  return Math.min(1, fighting / FULL_TUMULT);
}

/**
 * Lets a sound be heard only so many times in a short while, so that a burst of strikes does
 * not stack up into noise.
 */
export class SoundLimiter {
  private readonly recent = new Map<SoundId, number[]>();

  constructor(
    private readonly most = 3,
    private readonly windowSeconds = 0.3
  ) {}

  /** Whether the sound may play at `now` (seconds); counts it when it may. */
  allow(sound: SoundId, now: number): boolean {
    const times = (this.recent.get(sound) ?? []).filter((time) => now - time < this.windowSeconds);
    const allowed = times.length < this.most;
    if (allowed) times.push(now);
    this.recent.set(sound, times);
    return allowed;
  }
}
