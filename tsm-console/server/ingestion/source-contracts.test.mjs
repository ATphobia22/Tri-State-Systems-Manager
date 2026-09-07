import test from 'node:test';
import assert from 'node:assert/strict';

async function loadContracts() {
  try {
    return await import('./source-contracts.mjs');
  } catch (error) {
    throw new Error(`authoritative source-contracts module is unavailable: ${error.message}`);
  }
}

test('source record requires identity, timestamps, status, units, CRS/datum, and data class', async () => {
  const { assertSourceRecord } = await loadContracts();

  assert.doesNotThrow(() => assertSourceRecord({
    sourceId: 'USGS-NWIS-03378500-00065',
    sourceUri: 'https://waterservices.usgs.gov/nwis/iv/',
    observedAt: '2026-09-07T12:00:00Z',
    retrievedAt: '2026-09-07T12:00:05Z',
    status: 'provisional',
    dataClass: 'observation',
    unit: 'ft',
    crs: 'EPSG:4326',
    verticalDatum: 'GAGE_DATUM',
    provenance: { provider: 'USGS', parameterCode: '00065' },
  }));
});

test('source record rejects missing provenance fields', async () => {
  const { assertSourceRecord } = await loadContracts();

  assert.throws(() => assertSourceRecord({
    sourceId: 'USGS-NWIS-03378500-00065',
    observedAt: '2026-09-07T12:00:00Z',
    retrievedAt: '2026-09-07T12:00:05Z',
    status: 'provisional',
    dataClass: 'observation',
    unit: 'ft',
    crs: 'EPSG:4326',
    verticalDatum: 'GAGE_DATUM',
  }), /provenance/i);
});

test('source record rejects unsupported data classes', async () => {
  const { assertSourceRecord } = await loadContracts();

  assert.throws(() => assertSourceRecord({
    sourceId: 'USGS-NWIS-03378500-00065',
    sourceUri: 'https://waterservices.usgs.gov/nwis/iv/',
    observedAt: '2026-09-07T12:00:00Z',
    retrievedAt: '2026-09-07T12:00:05Z',
    status: 'provisional',
    dataClass: 'fictional',
    unit: 'ft',
    crs: 'EPSG:4326',
    verticalDatum: 'GAGE_DATUM',
    provenance: { provider: 'USGS' },
  }), /dataClass/i);
});
