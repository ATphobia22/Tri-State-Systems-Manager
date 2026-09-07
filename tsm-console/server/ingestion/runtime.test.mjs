import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestJson } from './http-client.mjs';
import { createMemoryCache } from './cache.mjs';
import { normalizeSourceRecord } from './normalization.mjs';

test('bounded HTTP client enforces response-size limit', async () => {
  const requestJson = createRequestJson({ fetchImpl: async () => new Response('123456789', { status: 200, headers: { 'content-length': '9' } }) });
  await assert.rejects(() => requestJson('https://example.invalid', { maxBytes: 8 }), /size/i);
});

test('memory cache expires entries by TTL', async () => {
  let now = 1000;
  const cache = createMemoryCache({ now: () => now });
  cache.set('k', { value: 1 }, 100);
  assert.deepEqual(cache.get('k'), { value: 1 });
  now += 101;
  assert.equal(cache.get('k'), null);
});

test('normalization produces a provenance-bearing evidence envelope', () => {
  const record = normalizeSourceRecord({ sourceId: 'USGS-NWIS-03378500-00065', sourceUri: 'https://waterservices.usgs.gov/nwis/iv/', observedAt: '2026-09-07T12:00:00Z', retrievedAt: '2026-09-07T12:00:05Z', status: 'provisional', dataClass: 'observation', unit: 'ft', crs: 'EPSG:4326', verticalDatum: 'GAGE_DATUM', provenance: { provider: 'USGS', parameterCode: '00065' } });
  assert.equal(record.sourceId, 'USGS-NWIS-03378500-00065');
  assert.equal(record.provenance.provider, 'USGS');
});
