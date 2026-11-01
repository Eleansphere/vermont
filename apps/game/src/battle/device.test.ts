import { describe, expect, it } from 'vitest';
import { resolveQuality } from './device';

describe('graphics quality', () => {
  it('keeps what the player chose', () => {
    expect(resolveQuality('low', { touch: false, shortSide: 1080 })).toBe('low');
  });

  it('draws phones at medium and everything else at high on auto', () => {
    expect(resolveQuality('auto', { touch: true, shortSide: 412 })).toBe('medium');
    expect(resolveQuality('auto', { touch: true, shortSide: 820 })).toBe('high');
    expect(resolveQuality('auto', { touch: false, shortSide: 1080 })).toBe('high');
  });
});
