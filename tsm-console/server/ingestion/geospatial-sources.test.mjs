import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeoJsonFeatureCollection, discoverFemaLayers } from './fema-nfhl.mjs';
import { normalizeIndianaFeatureCollection } from './indiana-gis.mjs';

test('preserves native CRS and rejects silent CRS conversion', () => {
  const normalized = normalizeGeoJsonFeatureCollection({ type: 'FeatureCollection', features: [] }, { sourceId: 'FEMA-NFHL', crs: 'EPSG:4269', retrievedAt: '2026-09-07T12:00:00Z' });
  assert.equal(normalized.crs, 'EPSG:4269');
  assert.throws(() => normalizeIndianaFeatureCollection({ type: 'FeatureCollection', features: [] }, { sourceId: 'INDIANA-GIS', retrievedAt: '2026-09-07T12:00:00Z' }), /CRS/i);
});

test('rejects FEMA layer discovery without service metadata', () => {
  assert.throws(() => discoverFemaLayers({ notLayers: [] }), /layers/i);
});
