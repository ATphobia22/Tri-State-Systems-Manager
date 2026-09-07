import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLeveeFeature } from './usace-nld.mjs';

test('normalizes National Levee Database features with provenance', () => {
  const record = normalizeLeveeFeature({ type: 'Feature', properties: { LEVEE_ID: 'L-1', NAME: 'Example' }, geometry: null }, { service: 'FeatureServer', crs: 'EPSG:4326', retrievedAt: '2026-09-07T12:00:00Z' });
  assert.equal(record.sourceId, 'USACE-NLD');
  assert.equal(record.sourceIdentifier, 'L-1');
  assert.equal(record.crs, 'EPSG:4326');
});

test('rejects levee records without source identity', () => {
  assert.throws(() => normalizeLeveeFeature({ type: 'Feature', properties: {}, geometry: null }, { service: 'FeatureServer', crs: 'EPSG:4326', retrievedAt: '2026-09-07T12:00:00Z' }), /identity/i);
});
