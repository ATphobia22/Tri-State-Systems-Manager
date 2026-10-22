import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeFloodMask, tryDatumConversion } from '../src/lib/canvas-flood-layer.ts';

test('unknown vertical-datum pairs do not substitute a constant offset', () => {
  assert.equal(tryDatumConversion(12.5, 'NAVD88', 'NAVD88'), 12.5);
  assert.equal(tryDatumConversion(12.5, 'NGVD29', 'NAVD88'), null);
  assert.equal(tryDatumConversion(Number.NaN, 'NAVD88', 'NAVD88'), null);
});

test('valid flood grids return a bounded mask', () => {
  const grid = {
    elevations: new Float32Array([1, 2, 3, 4]),
    rows: 2,
    cols: 2,
    bounds: [-88, 37, -87, 38],
    verticalDatum: 'NAVD88',
  };
  assert.deepEqual(Array.from(computeFloodMask(grid, 2)), [1, 1, 0, 0]);
});

test('invalid grids and non-finite water levels degrade to an empty mask', () => {
  const malformed = {
    elevations: new Float32Array([1, 2, 3]),
    rows: 2,
    cols: 2,
    bounds: [-88, 37, -87, 38],
    verticalDatum: 'NAVD88',
  };
  assert.equal(computeFloodMask(malformed, 2).length, 0);
  const valid = { ...malformed, elevations: new Float32Array([1, 2, 3, 4]) };
  assert.equal(computeFloodMask(valid, Number.NaN).length, 0);
});
