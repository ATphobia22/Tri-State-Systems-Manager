import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeoreferencedExtent, parseWorldFile } from '../server/geospatial/world-file.mjs';
import { validateWorldFileAssociation } from '../server/geospatial/firm-validation.mjs';

test('parses six world-file parameters deterministically', () => {
  const transform = parseWorldFile('5\n0\n0\n-5\n2633863.73129364\n961361.563108864\n');
  assert.deepEqual(transform, {
    a: 5,
    d: 0,
    b: 0,
    e: -5,
    c: 2633863.73129364,
    f: 961361.563108864,
  });
});

test('rejects malformed world files', () => {
  assert.throws(() => parseWorldFile('1\n2\n3'), /exactly six/);
  assert.throws(() => parseWorldFile('1\n2\n3\n4\n5\nnope'), /finite/);
});

test('calculates a deterministic raster extent', () => {
  const transform = parseWorldFile('5\n0\n0\n-5\n100\n200\n');
  assert.deepEqual(buildGeoreferencedExtent(transform, 3, 2), {
    minX: 100,
    minY: 195,
    maxX: 110,
    maxY: 200,
  });
});

test('fails closed when a candidate PGW belongs to another FIRM panel', () => {
  const result = validateWorldFileAssociation({
    panelId: '18129C0265C',
    worldFileName: '18129C0300C.pgw',
    rasterWidth: 1536,
    rasterHeight: 1103,
    worldFileText: '5\n0\n0\n-5\n2633863.73129364\n961361.563108864\n',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED_CLOSED_WORLD_FILE_ASSOCIATION');
  assert.match(result.errors[0], /expected 18129C0265C/);
});

test('accepts a matching world file when no conflicting extent is supplied', () => {
  const result = validateWorldFileAssociation({
    panelId: '18129C0265C',
    worldFileName: '18129C0265C.pgw',
    rasterWidth: 2,
    rasterHeight: 2,
    worldFileText: '5\n0\n0\n-5\n100\n200\n',
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'VALIDATED');
  assert.deepEqual(result.extent, { minX: 100, minY: 195, maxX: 105, maxY: 200 });
});
