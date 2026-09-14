import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRiverObservation, classifyFreshness } from './river-network.mjs';

test('normalizes an agency observation without discarding provenance', () => {
  const result = normalizeRiverObservation({
    stationId: '03378500',
    provider: 'USGS',
    observedAt: '2026-09-11T05:30:00Z',
    retrievedAt: '2026-09-11T05:31:00Z',
    value: 4.53,
    unit: 'ft',
    parameterCode: '00065',
    qualifier: 'P',
    verticalDatum: 'GAGE_DATUM',
    sourceUri: 'https://waterdata.usgs.gov/monitoring-location/USGS-03378500/',
  });

  assert.equal(result.stationId, '03378500');
  assert.equal(result.provider, 'USGS');
  assert.equal(result.value, 4.53);
  assert.equal(result.unit, 'ft');
  assert.equal(result.parameterCode, '00065');
  assert.equal(result.provisional, true);
  assert.equal(result.sourceUri.startsWith('https://'), true);
});

test('marks observations stale when age exceeds configured threshold', () => {
  const now = Date.parse('2026-09-11T06:00:00Z');
  assert.equal(classifyFreshness('2026-09-11T05:59:00Z', now, 900), 'current');
  assert.equal(classifyFreshness('2026-09-11T05:40:00Z', now, 900), 'stale');
});

test('rejects missing units or source provenance', () => {
  assert.throws(() => normalizeRiverObservation({ stationId: '03378500', provider: 'USGS', value: 4.5 }), /unit|source/i);
});
