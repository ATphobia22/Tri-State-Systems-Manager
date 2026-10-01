import test from 'node:test';
import assert from 'node:assert/strict';
import { appendH3SpatialIndex, H3_QUERY_RESOLUTION, SpatialInputError } from '../server/middleware/h3-indexer.mjs';

test('H3 spatial indexer rejects missing coordinates', () => {
  assert.throws(
    () => appendH3SpatialIndex({}),
    (error) => error instanceof SpatialInputError && error.code === 'SPATIAL_PARAMETER_INVALID',
  );
});

test('H3 spatial indexer rejects malformed coordinate types', () => {
  assert.throws(
    () => appendH3SpatialIndex({ latitude: '38.1294', longitude: -87.9356 }),
    (error) => error instanceof SpatialInputError && error.code === 'SPATIAL_PARAMETER_INVALID',
  );
});

test('H3 spatial indexer rejects out-of-bounds coordinates', () => {
  assert.throws(
    () => appendH3SpatialIndex({ latitude: 95, longitude: -87.9356 }),
    (error) => error instanceof SpatialInputError && error.code === 'SPATIAL_COORDINATE_OUT_OF_BOUNDS',
  );
});

test('H3 spatial indexer computes a valid resolution-8 cell', () => {
  const context = appendH3SpatialIndex({ latitude: 38.1294, longitude: -87.9356 });
  assert.equal(context.resolution, H3_QUERY_RESOLUTION);
  assert.match(context.h3IndexRes8, /^[0-9a-f]{15}$/);
  assert.equal(context.latitude, 38.1294);
  assert.equal(context.longitude, -87.9356);
});

test('H3 spatial indexer rejects unsupported resolutions', () => {
  assert.throws(
    () => appendH3SpatialIndex({ latitude: 38.1294, longitude: -87.9356, resolution: 9 }),
    (error) => error instanceof SpatialInputError && error.code === 'SPATIAL_RESOLUTION_UNSUPPORTED',
  );
});
