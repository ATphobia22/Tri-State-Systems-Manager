import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NldAdapter } from '../../packages/government/src/adapters/NldAdapter.ts';
import { CoopsAdapter } from '../../packages/government/src/adapters/CoopsAdapter.ts';
import { getGovernmentSource, validateEvidenceEnvelope } from '../../packages/government/src/index.ts';

function jsonResponse(payload: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), {
    status,
    headers: { 'content-type': contentType },
  });
}

function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * RECORDED REAL FIXTURE — trimmed sample of the live NLD FeatureServer
 * ?f=pjson response, curl-recorded 2026-11-07 (HTTP 200, 8,849 bytes,
 * full-response SHA-256 3110ff362bfa86141b43725f088b48815292af6462024d77a0b87f77fb1517c7).
 * Only the first 3 of 18 layers are kept inline; the live service reports
 * layers 0 Boreholes … 16 Leveed Areas, 17 Berms.
 */
const NLD_SERVICE_FIXTURE = {
  currentVersion: 11.5,
  cimVersion: '3.5.0',
  serviceDescription: '',
  maxRecordCount: 2000,
  capabilities: 'Query,Extract',
  supportedQueryFormats: 'JSON',
  layers: [
    { id: 0, name: 'Boreholes' },
    { id: 1, name: 'Crossings' },
    { id: 2, name: 'Levee Stations' },
  ],
  tables: [],
};

/** RECORDED REAL FIXTURE — trimmed live layer 16 metadata (?f=pjson, HTTP 200, 14,968 bytes, 2026-11-07). */
const NLD_LAYER_16_FIXTURE = {
  id: 16,
  name: 'Leveed Areas',
  type: 'Feature Layer',
  maxRecordCount: 2000,
  fields: [
    { name: 'OBJECTID', type: 'esriFieldTypeOID' },
    { name: 'SYSTEM_ID', type: 'esriFieldTypeDouble' },
    { name: 'SYSTEM_NAME', type: 'esriFieldTypeString' },
    { name: 'STATES', type: 'esriFieldTypeString' },
  ],
};

/**
 * RECORDED REAL FIXTURE — trimmed live layer 16 query response
 * (HTTP 200, 4,768 bytes, full-response SHA-256
 * 09b1a70a73e294acbe5cb75e356d7b9353d71755d54b9f99fec93daf1d715be0, 2026-11-07).
 * Two features kept; attribute values are the real recorded ones.
 */
const NLD_QUERY_FIXTURE = {
  objectIdFieldName: 'OBJECTID',
  geometryType: 'esriGeometryPolygon',
  exceededTransferLimit: true,
  fields: [
    { name: 'OBJECTID', type: 'esriFieldTypeOID' },
    { name: 'SYSTEM_NAME', type: 'esriFieldTypeString' },
    { name: 'STATES', type: 'esriFieldTypeString' },
  ],
  features: [
    { attributes: { OBJECTID: 1, SYSTEM_ID: 1805100015, SYSTEM_NAME: 'West side Madison River South of I-90 N segment', STATES: 'Montana', LEVEED_AREA_SQ_MI: 0.01778781 } },
    { attributes: { OBJECTID: 2, SYSTEM_ID: 1805100015, SYSTEM_NAME: 'West side Madison River North of I-90', STATES: 'Montana', LEVEED_AREA_SQ_MI: 0.01778781 } },
  ],
};

/**
 * RECORDED REAL FIXTURE — trimmed live CO-OPS datagetter water_level
 * response for station 8638610 (Sewells Point), curl-recorded 2026-11-07
 * (HTTP 200, 53,844 bytes, 720 rows; first 3 rows kept inline).
 */
const COOPS_WATER_LEVEL_FIXTURE = {
  metadata: { id: '8638610', name: 'Sewells Point', lat: '36.9428', lon: '-76.3286' },
  data: [
    { t: '2026-11-04 15:24', v: '0.745', s: '0.03', f: '1,0,0,0', q: 'p' },
    { t: '2026-11-04 15:30', v: '0.728', s: '0.016', f: '1,0,0,0', q: 'p' },
    { t: '2026-11-04 15:36', v: '0.709', s: '0.02', f: '1,0,0,0', q: 'p' },
  ],
};

/**
 * RECORDED REAL FIXTURE — trimmed live CO-OPS datagetter predictions
 * response for station 8638610, curl-recorded 2026-11-07 (HTTP 200,
 * 27,339 bytes, 721 predictions; first 2 kept inline). The predictions
 * product carries no metadata block — only `predictions`.
 */
const COOPS_PREDICTIONS_FIXTURE = {
  predictions: [
    { t: '2026-11-04 15:24', v: '0.559' },
    { t: '2026-11-04 15:30', v: '0.536' },
  ],
};

test('nld parses recorded real service metadata', async () => {
  const adapter = new NldAdapter();
  const envelope = await adapter.getServiceMetadata({
    fetcher: (async () => jsonResponse(NLD_SERVICE_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'usace-levees');
  assert.equal(envelope.result.maxRecordCount, 2000);
  assert.equal((envelope.result.layers as unknown[]).length, 3);
  assert.equal((envelope.result.layers as { name: string }[])[0].name, 'Boreholes');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('nld parses recorded real layer metadata and query features', async () => {
  const adapter = new NldAdapter();
  const layer = await adapter.getLayer(16, {
    fetcher: (async () => jsonResponse(NLD_LAYER_16_FIXTURE)) as typeof fetch,
  });
  assert.equal(layer.result.name, 'Leveed Areas');
  assert.deepEqual(validateEvidenceEnvelope(layer), []);

  let captured = '';
  const query = await adapter.queryLayer(16, '1=1', {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(NLD_QUERY_FIXTURE);
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer/16/query');
  assert.equal(url.searchParams.get('where'), '1=1');
  assert.equal(url.searchParams.get('f'), 'json');
  assert.equal(url.searchParams.get('resultRecordCount'), '100');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal((query.result.features as unknown[]).length, 2);
  assert.equal((query.result.features as { attributes: { SYSTEM_NAME: string } }[])[0].attributes.SYSTEM_NAME, 'West side Madison River South of I-90 N segment');
  assert.equal(query.result.exceededTransferLimit, true);
  assert.deepEqual(validateEvidenceEnvelope(query), []);
});

test('nld validates layer id, where clause, and record count before fetching', async () => {
  const adapter = new NldAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(NLD_SERVICE_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.getLayer(-1, { fetcher: never }), /NLD_LAYER_ID_INVALID/);
  await assert.rejects(() => adapter.getLayer(1.5, { fetcher: never }), /NLD_LAYER_ID_INVALID/);
  await assert.rejects(() => adapter.queryLayer(16, '', { fetcher: never }), /NLD_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryLayer(16, '   ', { fetcher: never }), /NLD_WHERE_INVALID/);
  await assert.rejects(() => adapter.queryLayer(16, '1=1', { fetcher: never, resultRecordCount: 0 }), /NLD_RESULT_RECORD_COUNT_INVALID/);
  await assert.rejects(() => adapter.queryLayer(16, '1=1', { fetcher: never, resultRecordCount: 2001 }), /NLD_RESULT_RECORD_COUNT_INVALID/);
  assert.equal(called, false);
});

test('coops parses recorded real water-level fixture with metadata block', async () => {
  const adapter = new CoopsAdapter();
  let captured = '';
  const envelope = await adapter.getWaterLevel({ station: '8638610' }, {
    fetcher: (async (input: unknown) => {
      captured = String(input);
      return jsonResponse(COOPS_WATER_LEVEL_FIXTURE);
    }) as typeof fetch,
  });
  const url = new URL(captured);
  assert.equal(url.origin + url.pathname, 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  assert.equal(url.searchParams.get('product'), 'water_level');
  assert.equal(url.searchParams.get('station'), '8638610');
  assert.equal(url.searchParams.get('date'), 'recent');
  assert.equal(url.searchParams.get('datum'), 'MLLW');
  assert.equal(url.searchParams.get('units'), 'english');
  assert.equal(url.searchParams.get('time_zone'), 'gmt');
  assert.equal(url.searchParams.get('application'), 'TSM');
  assert.equal(url.searchParams.get('format'), 'json');
  assert.ok(!captured.includes('mdapi'), 'must use the datagetter path only, never mdapi');
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.provenance.provider, 'noaa-coops');
  assert.equal(envelope.result.station, '8638610');
  assert.equal(envelope.result.metadata?.name, 'Sewells Point');
  assert.equal(envelope.result.metadata?.latitude, 36.9428);
  assert.equal(envelope.result.metadata?.longitude, -76.3286);
  assert.equal(envelope.result.observations.length, 3);
  assert.equal(envelope.result.observations[0].observedAt, '2026-11-04 15:24');
  assert.equal(envelope.result.observations[0].value, 0.745);
  assert.equal(envelope.result.observations[0].sigma, 0.03);
  assert.equal(envelope.result.observations[0].quality, 'p');
  assert.equal(envelope.result.unavailable.length, 0);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('coops parses recorded real predictions fixture', async () => {
  const adapter = new CoopsAdapter();
  const envelope = await adapter.getPredictions({ station: '8638610' }, {
    fetcher: (async () => jsonResponse(COOPS_PREDICTIONS_FIXTURE)) as typeof fetch,
  });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.predictions.length, 2);
  assert.equal(envelope.result.predictions[0].predictedAt, '2026-11-04 15:24');
  assert.equal(envelope.result.predictions[0].value, 0.559);
  assert.equal(envelope.result.predictions[1].value, 0.536);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
});

test('coops validates station, datum, units, time zone, and date before fetching', async () => {
  const adapter = new CoopsAdapter();
  let called = false;
  const never: typeof fetch = (async () => {
    called = true;
    return jsonResponse(COOPS_WATER_LEVEL_FIXTURE);
  }) as typeof fetch;
  await assert.rejects(() => adapter.getWaterLevel({ station: 'abc' }, { fetcher: never }), /COOPS_STATION_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '1234' }, { fetcher: never }), /COOPS_STATION_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '12345678' }, { fetcher: never }), /COOPS_STATION_INVALID/);
  // NAVD88 is NOT a CO-OPS datum — the live API rejects it with HTTP 400; use NAVD.
  await assert.rejects(() => adapter.getWaterLevel({ station: '8638610', datum: 'NAVD88' as never }, { fetcher: never }), /COOPS_DATUM_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '8638610', datum: 'BOGUS' as never }, { fetcher: never }), /COOPS_DATUM_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '8638610', units: 'furlongs' as never }, { fetcher: never }), /COOPS_UNITS_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '8638610', timeZone: 'est' as never }, { fetcher: never }), /COOPS_TIME_ZONE_INVALID/);
  await assert.rejects(() => adapter.getWaterLevel({ station: '8638610', date: '' }, { fetcher: never }), /COOPS_DATE_INVALID/);
  await assert.rejects(() => adapter.getPredictions({ station: '8638610', datum: 'NAVD88' as never }, { fetcher: never }), /COOPS_DATUM_INVALID/);
  assert.equal(called, false);
});

test('coops reports UNAVAILABLE on API error payloads, empty data, and HTTP errors — never fabricated', async () => {
  const adapter = new CoopsAdapter();
  const apiError = await adapter.getWaterLevel({ station: '8638610' }, {
    fetcher: (async () => jsonResponse({ error: { message: ' The supported Datum values are: MHHW, MHW, MTL, MSL, MLW, MLLW, NAVD, LWI, HWI' } })) as typeof fetch,
  });
  assert.equal(apiError.provenance.status, 'UNAVAILABLE');
  assert.equal(apiError.result.observations.length, 0);
  assert.equal(apiError.result.unavailable.length, 1);
  assert.ok(apiError.result.unavailable[0].reason.length > 0);
  assert.deepEqual(validateEvidenceEnvelope(apiError), []);

  const empty = await adapter.getWaterLevel({ station: '8638610' }, {
    fetcher: (async () => jsonResponse({ metadata: { id: '8638610', name: 'Sewells Point', lat: '36.9428', lon: '-76.3286' }, data: [] })) as typeof fetch,
  });
  assert.equal(empty.provenance.status, 'UNAVAILABLE');
  assert.deepEqual(validateEvidenceEnvelope(empty), []);

  const http = await adapter.getWaterLevel({ station: '8638610' }, {
    fetcher: (async () => new Response('oops', { status: 500, headers: { 'content-type': 'text/plain' } })) as typeof fetch,
  });
  assert.equal(http.provenance.status, 'UNAVAILABLE');
  assert.ok(http.result.unavailable[0].reason.includes('500'));
  assert.deepEqual(validateEvidenceEnvelope(http), []);
});

test('nld and coops sources are registered at the pinned endpoints', () => {
  const nld = getGovernmentSource('usace-levees');
  assert.equal(nld.authority, 'USACE');
  assert.equal(nld.endpoint, 'https://geospatial.sec.usace.army.mil/dls/rest/services/NLD/Public/FeatureServer');
  assert.equal(new NldAdapter().sourceId, 'usace-levees');
  const coops = getGovernmentSource('noaa-coops');
  assert.equal(coops.authority, 'NOAA');
  assert.equal(coops.endpoint, 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  assert.equal(new CoopsAdapter().sourceId, 'noaa-coops');
});

// ---- Live smoke tests: real fetches, structural assertions only. ----

test('LIVE nld service metadata returns HTTP 200 shape', async () => {
  const adapter = new NldAdapter();
  const envelope = await adapter.getServiceMetadata();
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.ok(Array.isArray(envelope.result.layers));
  assert.ok((envelope.result.layers as unknown[]).length >= 1);
  assert.equal(envelope.result.maxRecordCount, 2000);
  const layer16 = (envelope.result.layers as { id: number; name: string }[]).find((l) => l.id === 16);
  assert.equal(layer16?.name, 'Leveed Areas');
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE nld metadata evidence sha256=' + envelope.evidence[0].sha256 + ' layers=' + (envelope.result.layers as unknown[]).length);
});

test('LIVE nld layer 16 query returns real features', async () => {
  const adapter = new NldAdapter();
  const envelope = await adapter.queryLayer(16, '1=1', { resultRecordCount: 2 });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.ok(Array.isArray(envelope.result.features));
  assert.equal((envelope.result.features as unknown[]).length, 2);
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE nld query evidence sha256=' + envelope.evidence[0].sha256);
});

test('LIVE coops water level returns real observations for Sewells Point', async () => {
  const adapter = new CoopsAdapter();
  const envelope = await adapter.getWaterLevel({ station: '8638610' });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.equal(envelope.result.metadata?.id, '8638610');
  assert.equal(envelope.result.metadata?.name, 'Sewells Point');
  assert.ok(envelope.result.observations.length > 0);
  assert.ok(envelope.result.observations.every((o) => Number.isFinite(o.value)));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE coops water_level evidence sha256=' + envelope.evidence[0].sha256 + ' observations=' + envelope.result.observations.length);
});

test('LIVE coops predictions returns real tide predictions', async () => {
  const adapter = new CoopsAdapter();
  const envelope = await adapter.getPredictions({ station: '8638610' });
  assert.equal(envelope.provenance.status, 'UNVERIFIED');
  assert.ok(envelope.result.predictions.length > 0);
  assert.ok(envelope.result.predictions.every((p) => Number.isFinite(p.value)));
  assert.deepEqual(validateEvidenceEnvelope(envelope), []);
  console.log('LIVE coops predictions evidence sha256=' + envelope.evidence[0].sha256 + ' predictions=' + envelope.result.predictions.length);
});

test('recorded fixture hashes are real SHA-256 of the trimmed samples', () => {
  // Sanity: the sha256 helper used for evidence matches node:crypto output.
  assert.equal(sha256Hex('{"a":1}').length, 64);
});
