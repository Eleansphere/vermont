import type { GraphicsQuality } from '@vermont/render';
import type { QualitySetting } from '../stores/settings';

/** What the game needs to know about the device it runs on. */
export interface DeviceTraits {
  /** The main pointer is a finger: no hover, coarse aim. */
  readonly touch: boolean;
  /** The shorter side of the screen in CSS pixels. */
  readonly shortSide: number;
}

/** Below this short side the screen is a phone's. */
const PHONE_SHORT_SIDE = 600;

export function deviceTraits(): DeviceTraits {
  const touch =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const screenSize =
    typeof window !== 'undefined' && window.screen
      ? Math.min(window.screen.width, window.screen.height)
      : Number.POSITIVE_INFINITY;
  return { touch, shortSide: screenSize || Number.POSITIVE_INFINITY };
}

/** The quality to draw with: the player's choice, or by the device when left on auto. */
export function resolveQuality(
  setting: QualitySetting,
  device: DeviceTraits = deviceTraits()
): GraphicsQuality {
  if (setting !== 'auto') return setting;
  if (!device.touch) return 'high';
  return device.shortSide < PHONE_SHORT_SIDE ? 'medium' : 'high';
}
