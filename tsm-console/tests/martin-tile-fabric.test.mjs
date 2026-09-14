import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveMartinTileUrl, resolveThreeDTilesetUrl } = await import('../src/lib/martin-tile-fabric.ts');

test('resolves a deterministic Martin tile URL', () => {
  assert.equal(
    resolveMartinTileUrl({ id: 'indiana-bafm', kind: 'vector', enabled: true }, 12, 1100, 1450),
    '/tiles/indiana-bafm/12/1100/1450',
  );
});

test('rejects disabled Martin sources', () => {
  assert.throws(
    () => resolveMartinTileUrl({ id: 'indiana-bafm', kind: 'vector', enabled: false }, 12, 1, 1),
    /disabled/,
  );
});

test('rejects unsafe source identifiers', () => {
  assert.throws(
    () => resolveMartinTileUrl({ id: '../secret', kind: 'vector', enabled: true }, 1, 1, 1),
    /Invalid tile source id/,
  );
});

test('resolves explicitly registered OGC 3D Tiles sources', () => {
  assert.equal(
    resolveThreeDTilesetUrl({
      id: 'photogrammetry',
      tilesetUrl: 'https://tiles.example.invalid/photogrammetry/tileset.json',
      enabled: true,
    }),
    'https://tiles.example.invalid/photogrammetry/tileset.json',
  );
});

test('rejects non-http 3D Tiles URLs', () => {
  assert.throws(
    () => resolveThreeDTilesetUrl({ id: 'photogrammetry', tilesetUrl: 'file:///tmp/tileset.json', enabled: true }),
    /HTTP or HTTPS/,
  );
});
