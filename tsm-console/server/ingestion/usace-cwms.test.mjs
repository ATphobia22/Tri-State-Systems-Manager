import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchCatalogTimeseries,
  fetchTimeseries,
  fetchRecentTimeseries,
  USACE_CWMS_API,
} from './usace-cwms.mjs';

// Offline excerpt of verified 2026-10-06 harvest fixture:
// ~/workspace/tsm-usace-harvest/responses/cwms-recent.json
const RECENT_FIXTURE = [
  {
    id: 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev',
    dqu: {
      'office-id': 'LRL',
      'cwms-ts-id': 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev',
      'unit-id': 'ft',
      'date-time': 1791276300000,
      'version-date': -27079747200000,
      'data-entry-date': 1791277677593,
      value: 5.049999999999999,
      'quality-code': 3,
      'start-date': 1470710988487,
      'end-date': 1791277677593,
    },
  },
];

const CATALOG_FIXTURE = {
  entries: [
    { name: 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev', office: 'LRL', units: 'm' },
    { name: 'MtCarmel.Stage.Inst.15Minutes.0.LRGS', office: 'LRL', units: 'm' },
  ],
};

const TIMESERIES_FIXTURE = {
  name: 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev',
  office: 'LRL',
  values: [
    { 'cwms-ts-id': 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev', 'office-id': 'LRL', 'unit-id': 'm', 'date-time': 1791189900000, value: 1.54, 'quality-code': 3 },
    { 'cwms-ts-id': 'MtCarmel.Stage.Inst.15Minutes.0.USGS-rev', 'office-id': 'LRL', 'unit-id': 'm', 'date-time': 1791190800000, value: 1.55, 'quality-code': 3 },
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

test('fetchRecentTimeseries builds the official recent-values URL', async () => {
  const request = mockRequest(RECENT_FIXTURE);
  const result = await fetchRecentTimeseries(['MtCarmel.Stage.Inst.15Minutes.0.USGS-rev'], 'LRL', { request });
  assert.equal(request.calls.length, 1);
  const url = new URL(request.calls[0].url);
  assert.equal(url.origin + url.pathname, `${USACE_CWMS_API}timeseries/recent`);
  assert.equal(url.searchParams.get('office'), 'LRL');
  assert.ok(url.searchParams.get('ts-ids').includes('MtCarmel'));
  assert.equal(result.values.length, 1);
  const value = result.values[0];
  assert.equal(value.sourceId, 'USACE-CWMS');
  assert.equal(value.dataClass, 'observed');
  assert.equal(value.provenance.authority, 'USACE');
  assert.equal(value.provenance.provider, 'USACE CWMS');
  assert.ok(Math.abs(value.value - 5.05) < 1e-9);
  assert.equal(value.unit, 'ft');
  assert.equal(value.qualityCode, 3);
});

test('fetchRecentTimeseries rejects missing ids, office, and unofficial hosts', async () => {
  const request = mockRequest(RECENT_FIXTURE);
  await assert.rejects(() => fetchRecentTimeseries([], 'LRL', { request }), /at least one/);
  await assert.rejects(() => fetchRecentTimeseries(['x'], '', { request }), /office/);
  await assert.rejects(() => fetchRecentTimeseries(['x'], 'LRL', { base: 'https://example.com/cwms/', request }), /official/);
});

test('fetchCatalogTimeseries returns catalog entries', async () => {
  const request = mockRequest(CATALOG_FIXTURE);
  const result = await fetchCatalogTimeseries('LRL', '*Mt*Carmel*Stage*', { request });
  const url = new URL(request.calls[0].url);
  assert.ok(url.pathname.endsWith('/catalog/TIMESERIES'));
  assert.equal(url.searchParams.get('office'), 'LRL');
  assert.equal(result.entries.length, 2);
});

test('fetchCatalogTimeseries requires an office', async () => {
  const request = mockRequest(CATALOG_FIXTURE);
  await assert.rejects(() => fetchCatalogTimeseries('', '*x*', { request }), /office/);
});

test('fetchTimeseries requires name, office, and a time window', async () => {
  const request = mockRequest(TIMESERIES_FIXTURE);
  const result = await fetchTimeseries('MtCarmel.Stage.Inst.15Minutes.0.USGS-rev', 'LRL', '2026-10-05T00:00:00Z', '2026-10-06T00:00:00Z', 'm', { request });
  assert.equal(result.values.length, 2);
  assert.equal(result.values[0].dataClass, 'observed');
  assert.equal(result.values[0].unit, 'm');
  await assert.rejects(() => fetchTimeseries('', 'LRL', 'a', 'b', 'm', { request }), /name/);
  await assert.rejects(() => fetchTimeseries('x', 'LRL', null, 'b', 'm', { request }), /begin/);
});
