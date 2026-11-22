import { describe, expect, it } from 'vitest';
import { resolveMartinTileUrl, resolveThreeDTilesetUrl } from '../src/lib/martin-tile-fabric';

describe('Martin tile fabric', () => {
  it('resolves a deterministic Martin tile URL', () => {
    expect(
      resolveMartinTileUrl({ id: 'indiana-bafm', kind: 'vector', enabled: true }, 12, 1100, 1450),
    ).toBe('/tiles/indiana-bafm/12/1100/1450');
  });

  it('rejects disabled Martin sources', () => {
    expect(() =>
      resolveMartinTileUrl({ id: 'indiana-bafm', kind: 'vector', enabled: false }, 12, 1, 1),
    ).toThrow(/disabled/);
  });

  it('rejects unsafe source identifiers', () => {
    expect(() =>
      resolveMartinTileUrl({ id: '../secret', kind: 'vector', enabled: true }, 1, 1, 1),
    ).toThrow(/Invalid tile source id/);
  });

  it('resolves explicitly registered OGC 3D Tiles sources', () => {
    expect(
      resolveThreeDTilesetUrl({
        id: 'photogrammetry',
        tilesetUrl: 'https://tiles.example.invalid/photogrammetry/tileset.json',
        enabled: true,
      }),
    ).toBe('https://tiles.example.invalid/photogrammetry/tileset.json');
  });

  it('rejects non-http 3D Tiles URLs', () => {
    expect(() =>
      resolveThreeDTilesetUrl({
        id: 'photogrammetry',
        tilesetUrl: 'file:///tmp/tileset.json',
        enabled: true,
      }),
    ).toThrow(/HTTP or HTTPS/);
  });
});


describe('3D Tiles URL validation', () => {
  it('rejects URLs with embedded credentials', () => {
    expect(() => resolveThreeDTilesetUrl({
      id: 'photogrammetry',
      tilesetUrl: 'https://user:secret@tiles.example.invalid/tileset.json',
      enabled: true,
    })).toThrow(/without embedded credentials/);
  });

  it('rejects protocol-relative and ambiguous URL forms', () => {
    for (const tilesetUrl of [
      '//tiles.example.invalid/tileset.json',
      'javascript:alert(1)',
      'https://tiles.example.invalid\\\\@evil.invalid/tileset.json',
      ' https://tiles.example.invalid/tileset.json ',
    ]) {
      expect(() => resolveThreeDTilesetUrl({ id: 'photogrammetry', tilesetUrl, enabled: true })).toThrow();
    }
  });
});


describe('XYZ tile bounds and source isolation', () => {
  const source = { id: 'indiana-bafm', kind: 'vector' as const, enabled: true };

  it('accepts the canonical XYZ world edges without wrapping or truncation', () => {
    expect(resolveMartinTileUrl(source, 0, 0, 0)).toBe('/tiles/indiana-bafm/0/0/0');
    expect(resolveMartinTileUrl(source, 20, 2 ** 20 - 1, 2 ** 20 - 1))
      .toBe('/tiles/indiana-bafm/20/1048575/1048575');
  });

  it('rejects impossible XYZ tile coordinates, not just negative values', () => {
    for (const [z, x, y] of [[0, 1, 0], [1, 0, 2], [12, 4096, 1],
                              [12, 1, 4096], [30, 2 ** 30, 0]]) {
      expect(() => resolveMartinTileUrl(source, z, x, y)).toThrow(/Invalid tile [xy] coordinate/);
    }
  });

  it('preserves existing trailing slash path normalization for valid source roots', () => {
    expect(resolveMartinTileUrl(source, 12, 1100, 1450, '/tiles/'))
      .toBe('/tiles/indiana-bafm/12/1100/1450');
  });

  it('rejects traversal, duplicate separators and ambiguous Martin URL base paths', () => {
    for (const base of ['/tiles/../admin', '/tiles//admin', '/tiles/./parcel', '/tiles/..']) {
      expect(() => resolveMartinTileUrl(source, 12, 1100, 1450, base))
        .toThrow(/Invalid Martin base path/);
    }
  });
});
