/** What a key press asks for during a battle. Camera keys belong to the renderer. */
export type ShortcutAction =
  'endTurn' | 'undo' | 'next' | 'previous' | 'relief' | 'toggleLog' | 'escape' | 'help';

/** The part of a keyboard event the shortcuts look at. */
export interface KeyPress {
  readonly code: string;
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly target: EventTarget | null;
}

/** Keys by physical position, so they work the same on every keyboard layout. */
const PLAIN_KEYS: Readonly<Record<string, ShortcutAction>> = {
  Enter: 'endTurn',
  NumpadEnter: 'endTurn',
  Backspace: 'undo',
  KeyR: 'relief',
  KeyL: 'toggleLog',
  KeyH: 'help',
  Escape: 'escape',
};

/** Elements that use Enter themselves; a press there must not also end the turn. */
const ACTIVATED_BY_ENTER = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'];

/** The action the key press stands for, or `null` when it is not a shortcut. */
export function shortcutFor(press: KeyPress): ShortcutAction | null {
  if (press.altKey) return null;
  if (press.ctrlKey || press.metaKey) {
    // By the letter, not the position: Ctrl+Z is where the layout has its Z.
    return press.key.toLowerCase() === 'z' && !press.shiftKey ? 'undo' : null;
  }
  if (press.code === 'Tab') return press.shiftKey ? 'previous' : 'next';

  const action = PLAIN_KEYS[press.code] ?? null;
  if (action === 'endTurn' && isActivatedByEnter(press.target)) return null;
  return action;
}

function isActivatedByEnter(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ACTIVATED_BY_ENTER.includes(target.tagName);
}
