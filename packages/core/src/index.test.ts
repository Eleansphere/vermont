import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from './index';

describe('core', () => {
  it('exposes the rules version', () => {
    expect(RULES_VERSION).toBe(3);
  });
});
