import { describe, expect, it } from 'vitest';
import { audioFiles } from './sounds';

/** The files the game serves from its public folder, found when the test is built. */
const SHIPPED = Object.keys(import.meta.glob('../../public/audio/**/*', { query: '?url' })).map(
  (path) => path.replace('../../public/audio/', '')
);

describe('sound files', () => {
  it('ships every file the game plays, with the credits', () => {
    for (const file of [...audioFiles(), 'CREDITS.md']) {
      expect(SHIPPED, file).toContain(file);
    }
  });

  it('ships no sound the game does not play', () => {
    const played = new Set(audioFiles());
    expect(SHIPPED.filter((file) => file !== 'CREDITS.md' && !played.has(file))).toEqual([]);
  });
});
