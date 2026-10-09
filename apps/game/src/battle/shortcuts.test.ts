import { describe, expect, it } from 'vitest';
import type { KeyPress } from './shortcuts';
import { shortcutFor } from './shortcuts';

function press(code: string, overrides: Partial<KeyPress> = {}): KeyPress {
  return {
    code,
    key: code.replace(/^Key/, '').toLowerCase(),
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: document.body,
    ...overrides,
  };
}

describe('shortcutFor', () => {
  it.each([
    ['Enter', 'endTurn'],
    ['NumpadEnter', 'endTurn'],
    ['Backspace', 'undo'],
    ['Tab', 'next'],
    ['KeyR', 'relief'],
    ['KeyL', 'toggleLog'],
    ['KeyH', 'help'],
    ['Escape', 'escape'],
  ])('reads %s as %s', (code, action) => {
    expect(shortcutFor(press(code))).toBe(action);
  });

  it('goes to the previous unit with Shift+Tab', () => {
    expect(shortcutFor(press('Tab', { shiftKey: true }))).toBe('previous');
  });

  it('undoes with Ctrl+Z wherever the layout has its Z', () => {
    expect(shortcutFor(press('KeyY', { key: 'z', ctrlKey: true }))).toBe('undo');
    expect(shortcutFor(press('KeyZ', { key: 'Z', metaKey: true }))).toBe('undo');
    expect(shortcutFor(press('KeyZ', { key: 'z', ctrlKey: true, shiftKey: true }))).toBeNull();
  });

  it('leaves the camera keys and browser shortcuts alone', () => {
    expect(shortcutFor(press('KeyQ'))).toBeNull();
    expect(shortcutFor(press('KeyR', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press('KeyL', { altKey: true }))).toBeNull();
  });

  it('does not end the turn with Enter on a focused button', () => {
    const button = document.createElement('button');

    expect(shortcutFor(press('Enter', { target: button }))).toBeNull();
    expect(shortcutFor(press('Escape', { target: button }))).toBe('escape');
  });
});
