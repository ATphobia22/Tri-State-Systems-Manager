import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLeveeFeature,
  normalizeLeveeSystem,
  normalizeLeveedAreaFeature,
  suggestLeveeSystems,
  fetchLeveeSystems,
  fetchLeveedAreaGeoJSON,
  USACE_NLD2_API,
  NLD2_HORIZONTAL_CRS,
  NLD2_VERTICAL_DATUM,
} from './usace-nld.mjs';

// Offline excerpts of verified 2026-10-06 harvest fixtures:
// ~/workspace/tsm-usace-harvest/responses/nld2-suggest-posey.json,
// nld2-systems-wabash.json, nld2-leveed-areas.geojson
const SUGGEST_FIXTURE = {
  suggestions: {
    contexts: [{ name: 'COUNTY STATE', value: 'Posey, Indiana', suggestion: 'Posey, IN' }],
    segments: [],
    systems: [{ id: '270005000005', name: 'Wabash Levee Unit 1' }],
    fema6510: [],
    femaApproach: [],
    femaPal: [],
    femaSystem: [],
  },
};

const SYSTEM_FIXTURE = [
  {
    id: 270005000005,
    name: 'Wabash Levee Unit 1',
    states: 'Indiana',
    leveedAreaSquareMiles: 0.34089,
  },
];

const LEVEED_AREA_FIXTURE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { leveedId: 270006000009, fcSystemId: 270005000005 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [[[[-87.2641, 38.7206], [-87.2642, 38.7207], [-87.2640, 38.7208], [-87.2641, 38.7206]]]],
      },
    },
  ],
};

function mockRequest(payload) {
  const calls = [];
  const request = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return payload;
  };
  request.calls = calls;
  return request;
}

test('normalizes National Levee Database features with provenance', () => {
  const record = normalizeLeveeFeature({ type: 'Feature', properties: { LEVEE_ID: 'L-1', NAME: 'Example' }, geometry: null }, { service: 'FeatureServer', crs: 'EPSG:4326', retrievedAt: '2026-09-07T12:00:00Z' });
  assert.equal(record.sourceId, 'USACE-NLD');
  assert.equal(record.sourceIdentifier, 'L-1');
  assert.equal(record.crs, 'EPSG:4326');
});

test('rejects levee records without source identity', () => {
  assert.throws(() => normalizeLeveeFeature({ type: 'Feature', properties: {}, geometry: null }, { service: 'FeatureServer', crs: 'EPSG:4326', retrievedAt: '2026-09-07T12:00:00Z' }), /identity/i);
});

test('normalizes NLD2 levee system records with authority classification', () => {
  const record = normalizeLeveeSystem(SYSTEM_FIXTURE[0], { retrievedAt: '2026-10-06T10:00:00Z' });
  assert.equal(record.sourceId, 'USACE-NLD2');
  assert.equal(record.sourceIdentifier, '270005000005');
  assert.equal(record.name, 'Wabash Levee Unit 1');
  assert.equal(record.provenance.authority, 'USACE');
  assert.equal(record.dataClass, 'evidence');
  assert.equal(record.crs, NLD2_HORIZONTAL_CRS);
  assert.equal(record.verticalDatum, NLD2_VERTICAL_DATUM);
});

test('rejects NLD2 system records without id', () => {
  assert.throws(() => normalizeLeveeSystem({ name: 'x' }, { retrievedAt: '2026-10-06T10:00:00Z' }), /id/i);
});

test('normalizes NLD2 leveed-area polygon features', () => {
  const record = normalizeLeveedAreaFeature(LEVEED_AREA_FIXTURE.features[0], { service: 'https://levees.sec.usace.army.mil/api/leveed-areas-270005000005.geojson', systemId: '270005000005', retrievedAt: '2026-10-06T10:00:00Z' });
  assert.equal(record.sourceId, 'USACE-NLD2');
  assert.equal(record.sourceIdentifier, '270006000009');
  assert.equal(record.geometry.type, 'MultiPolygon');
  assert.equal(record.provenance.systemId, '270005000005');
});

test('rejects non-polygon leveed-area features', () => {
  const bad = { type: 'Feature', properties: { leveedId: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } };
  assert.throws(() => normalizeLeveedAreaFeature(bad, { service: 'x', systemId: '1', retrievedAt: '2026-10-06T10:00:00Z' }), /polygon/i);
});

test('suggestLeveeSystems POSTs to the official NLD2 API', async () => {
  const request = mockRequest(SUGGEST_FIXTURE);
  const result = await suggestLeveeSystems('Posey', { request });
  assert.equal(request.calls.length, 1);
  assert.equal(request.calls[0].url, `${USACE_NLD2_API}/system/suggestions`);
  assert.equal(request.calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(request.calls[0].options.body), { text: 'Posey' });
  assert.equal(result.suggestions.systems[0].id, '270005000005');
});

test('suggestLeveeSystems rejects empty text and unofficial hosts', async () => {
  const request = mockRequest(SUGGEST_FIXTURE);
  await assert.rejects(() => suggestLeveeSystems('   ', { request }), /non-empty/);
  await assert.rejects(() => suggestLeveeSystems('Posey', { base: 'https://example.com/api', request }), /official/);
});

test('fetchLeveeSystems POSTs ids and normalizes records', async () => {
  const request = mockRequest(SYSTEM_FIXTURE);
  const records = await fetchLeveeSystems(['270005000005'], { request });
  assert.equal(request.calls[0].url, `${USACE_NLD2_API}/system/systems`);
  assert.deepEqual(JSON.parse(request.calls[0].options.body), { ids: ['270005000005'] });
  assert.equal(records.length, 1);
  assert.equal(records[0].sourceIdentifier, '270005000005');
});

test('fetchLeveedAreaGeoJSON validates the FeatureCollection', async () => {
  const request = mockRequest(LEVEED_AREA_FIXTURE);
  const result = await fetchLeveedAreaGeoJSON('270005000005', { request });
  assert.equal(request.calls[0].url, `${USACE_NLD2_API}/leveed-areas-270005000005.geojson`);
  assert.equal(result.features.length, 1);
  assert.equal(result.crs, NLD2_HORIZONTAL_CRS);
});

test('fetchLeveedAreaGeoJSON rejects non-FeatureCollection payloads', async () => {
  const request = mockRequest({ type: 'Feature', features: [] });
  await assert.rejects(() => fetchLeveedAreaGeoJSON('270005000005', { request }), /FeatureCollection/);
});
