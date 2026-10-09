import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { TERRAINS } from '../data/terrains';
import { hexKey } from '../hex/hex';
import { mapHexes, terrainAt } from './battleMap';
import { TERRAIN_SYMBOLS, gridSize, mapFromGrid } from './mapGrid';
import { rectangleHex, rectangleHexes } from './shapes';

describe('map grid', () => {
  const GRID = ['. f ~', ' h = .'];

  it('builds a rectangle with the terrain drawn on it', () => {
    const map = mapFromGrid('test', GRID);
    const rowOf = (row: number) =>
      [0, 1, 2].map((column) => terrainAt(map, TERRAINS, rectangleHex(column, row))?.id);

    expect(map.id).toBe('test');
    expect(mapHexes(map).map(hexKey).sort()).toEqual(rectangleHexes(3, 2).map(hexKey).sort());
    expect(rowOf(0)).toEqual(['plain', 'forest', 'river']);
    expect(rowOf(1)).toEqual(['hill', 'ford', 'plain']);
  });

  it('does not care how the symbols are spaced', () => {
    expect(mapFromGrid('test', ['.f~', 'h=.'])).toEqual(mapFromGrid('test', GRID));
  });

  it('tells how big the drawn map is', () => {
    expect(gridSize('test', GRID)).toEqual({ width: 3, height: 2 });
  });

  it('has a symbol for every terrain but the camp', () => {
    const drawn: string[] = Object.values(TERRAIN_SYMBOLS);
    const expected = Object.keys(TERRAINS).filter((id) => id !== 'camp');

    expect([...drawn].sort()).toEqual(expected.sort());
  });

  it('rejects a grid with nothing in it', () => {
    expect(() => mapFromGrid('test', [])).toThrow('no hexes');
    expect(() => mapFromGrid('test', ['  '])).toThrow('no hexes');
  });

  it('rejects rows of different lengths', () => {
    expect(() => mapFromGrid('test', ['. . .', '. .'])).toThrow('Row 1 of map "test" has 2 hexes');
  });

  it('rejects a symbol that stands for no terrain', () => {
    expect(() => mapFromGrid('test', ['. ? .'])).toThrow('Unknown terrain "?" in row 0');
  });
});

describe('the maps in the data', () => {
  it.each(Object.entries(MAPS))('%s is stored under its own id', (id, map) => {
    expect(map.id).toBe(id);
  });

  it('keep the sizes agreed for them', () => {
    const sizeOf = (id: string) => mapHexes(MAPS[id]!).length;

    expect(sizeOf('trebia')).toBe(14 * 12);
    expect(sizeOf('cannae')).toBe(16 * 12);
    expect(sizeOf('zama')).toBe(16 * 12);
  });

  it('put one bridge over the river at Cannae', () => {
    const terrains = Object.values(MAPS.cannae!.hexes).map((mapHex) => mapHex.terrain);

    expect(terrains.filter((terrain) => terrain === 'bridge')).toHaveLength(1);
  });
});
