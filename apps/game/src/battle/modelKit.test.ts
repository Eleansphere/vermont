import { describe, expect, it } from 'vitest';
import { kitFiles } from '@vermont/render';

/** The files the game serves from its public folder, found when the test is built. */
const SHIPPED = Object.keys(import.meta.glob('../../public/models/**/*', { query: '?url' })).map(
  (path) => path.replace('../../public/models/', '')
);

describe('model kit files', () => {
  it('ships every file the renderer loads, with the credits', () => {
    for (const file of [...kitFiles(), 'CREDITS.md']) {
      expect(SHIPPED, file).toContain(file);
    }
  });

  it('ships the binary and the texture every terrain model points to', () => {
    for (const file of kitFiles().filter((name) => name.endsWith('.gltf'))) {
      expect(SHIPPED).toContain(file.replace('.gltf', '.bin'));
    }
    expect(SHIPPED).toContain('terrain/hexagons_medieval.png');
  });
});
