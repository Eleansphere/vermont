import type { SavedGame } from './savedGame';

export const SAVE_STORAGE_KEY = 'vermont.save';

/** The battle kept in the browser from the last visit, as it was written; `null` when none is. */
export function storedSave(): string | null {
  try {
    return localStorage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Keeps the battle in the browser for the next visit; `null` forgets the one kept there. */
export function storeSave(saved: SavedGame | null): void {
  try {
    if (saved) localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saved));
    else localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Without storage the battle still goes on; it just cannot be picked up after the visit.
  }
}

/** Hands the battle to the player as a file. */
export function downloadSave(saved: SavedGame, fileName: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(saved)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
