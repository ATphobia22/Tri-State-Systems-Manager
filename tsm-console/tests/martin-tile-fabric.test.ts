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
