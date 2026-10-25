import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchUsgsLatestContinuous } from '../src/lib/usgs-direct.ts';

const SITE = '03378500';
const TIME = '2026-10-25T12:00:00Z';
function feature(value, extra = {}) {
  return { type: 'Feature', properties: {
    monitoring_location_id: `USGS-${SITE}`,
    parameter_code: '00065',
    time: TIME,
    value,
    unit_of_measure: 'ft',
    approval_status: 'Provisional',
    ...extra,
  }};
}
function fetcherFor(features, onUrl = () => {}) {
  return async (url, options) => {
    onUrl(new URL(url), options);
    return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
      status: 200,
      headers: { 'content-type': 'application/geo+json' },
    });
  };
}
test('valid stage preserves provenance; discharge has no vertical datum', async () => {
  const items = await fetchUsgsLatestContinuous(SITE, ['00065', '00060'], {
    fetcher: fetcherFor([feature('15.31'), feature(255000, { parameter_code: '00060', unit_of_measure: 'ft^3/s' })]),
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].value, 15.31);
  assert.equal(items[0].observedAt, TIME);
  assert.equal(items[0].verticalDatum, 'GAGE_DATUM');
  assert.equal(items[0].approvalStatus, 'Provisional');
  assert.equal(items[1].verticalDatum, null);
  assert.equal(items[1].unit, 'ft^3/s');
});
test('zero is valid; missing, null, blank, boolean and no-data are not zero', async () => {
  const candidates = [null, false, true, '', '  ', undefined, -999, '-999', -9999, -8888, 'NaN', 'Infinity', {}, []];
  const items = await fetchUsgsLatestContinuous(SITE, ['00065'], {
    fetcher: fetcherFor([...candidates.map((value) => feature(value)), feature(0)]),
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].value, 0);
});
test('reject cross-station, unrequested parameter, missing time and missing unit', async () => {
  const bad = [
    feature(10, { monitoring_location_id: 'USGS-03381700' }),
    feature(11, { monitoring_location_id: undefined }),
    feature(12, { parameter_code: '00060' }),
    feature(13, { time: undefined }),
    feature(14, { time: '2026-10-25T12:00:00' }),
    feature(15, { time: 'invalid' }),
    feature(16, { unit_of_measure: null }),
  ];
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, ['00065'], {
    fetcher: fetcherFor(bad),
  }), /no usable station-matched/);
});
test('validate inputs before fetch; use the documented v1 endpoint', async () => {
  let count = 0;
  const mock = fetcherFor([feature(1)], (url, options) => {
    count++;
    assert.equal(url.origin + url.pathname, 'https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous/items');
    assert.equal(url.searchParams.get('monitoring_location_id'), `USGS-${SITE}`);
    assert.equal(url.searchParams.get('parameter_code'), '00065');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Accept, 'application/json');
  });
  await assert.rejects(() => fetchUsgsLatestContinuous('abc', ['00065'], { fetcher: mock }), /INVALID_STATION/);
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, [], { fetcher: mock }), /UNSUPPORTED_PARAMETERS/);
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, ['99999'], { fetcher: mock }), /UNSUPPORTED_PARAMETERS/);
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, ['00065'], { fetcher: mock, timeoutMs: -1 }), /INVALID_TIMEOUT/);
  assert.equal(count, 0);
  await fetchUsgsLatestContinuous(SITE, ['00065'], { fetcher: mock });
  assert.equal(count, 1);
});
test('malformed responses and server failures do not synthesize observations', async () => {
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, ['00065'], {
    fetcher: async () => new Response('{}', { status: 200 }),
  }), /INVALID_FEATURE_COLLECTION/);
  await assert.rejects(() => fetchUsgsLatestContinuous(SITE, ['00065'], {
    fetcher: async () => new Response('unavailable', { status: 503 }),
  }), /HTTP 503/);
});
