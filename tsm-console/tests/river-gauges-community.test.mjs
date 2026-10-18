import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/lib/river-gauges.ts', import.meta.url), 'utf8');
const board = await readFile(new URL('../src/components/RiverGaugeBoard.tsx', import.meta.url), 'utf8');

test('community gauge registry includes the primary Wabash and Ohio observations', () => {
  assert.match(source, /03378500/);
  assert.match(source, /03322000/);
  assert.match(source, /03399800/);
  assert.match(source, /03303280/);
  assert.match(source, /03612600/);
  assert.match(source, /03293551/);
  assert.doesNotMatch(source, /03293600/);
});

test('runtime gauge client preserves provenance and fails closed', () => {
  assert.match(source, /observedAt/);
  assert.match(source, /retrievedAt/);
  assert.match(source, /provisional/);
  assert.match(source, /status: definition\.status === 'active' \? 'unavailable' : 'candidate'/);
  assert.match(source, /isFresh\(observedAt, nowMs, maxAgeMs\) \? 'current' : 'stale'/);
});

test('river gauge board uses explicit on-demand snapshots and never polls', () => {
  assert.match(board, /on-demand snapshots/);
  assert.match(board, /No automatic polling/);
  assert.match(board, /Fetch live snapshot/);
  assert.match(board, /const fetchSnapshot = useCallback/);
  assert.match(board, /tsmApiUrl/);
  assert.doesNotMatch(board, /fetchUsgsLatestContinuous/);
  assert.match(source, /gaugeEndpoint\(\)/);
  assert.doesNotMatch(source, /fetchUsgsFallback/);
  assert.match(board, /not fabricated/);
  assert.match(board, /aria-labelledby/);
  assert.doesNotMatch(board, /setInterval/);
});


test('static gauge map layer matches active USGS station registry and has valid WGS84 coordinates', async () => {
  const geojson = JSON.parse(await readFile(new URL('../public/data/tsm-river-gauge-locations.geojson', import.meta.url), 'utf8'));
  const registry = JSON.parse(await readFile(new URL('../../artifacts/tsm-river-valley-realtime-stations-v1.json', import.meta.url), 'utf8'));
  const expectedIds = registry.verified_observation_stations
    .filter((station) => station.status === 'active')
    .map((station) => station.station_id)
    .sort();
  const featureIds = geojson.features.map((feature) => feature.properties.stationId).sort();

  assert.deepEqual(featureIds, expectedIds);
  assert.equal(geojson.crs, 'EPSG:4326');
  assert.ok(geojson.features.every((feature) =>
    feature.geometry.type === 'Point' &&
    feature.geometry.coordinates.length === 2 &&
    feature.geometry.coordinates.every(Number.isFinite) &&
    feature.properties.locationOnly === true &&
    feature.properties.automaticPolling === false
  ));
  assert.ok(!featureIds.includes('03293600'));
  assert.ok(!featureIds.includes('03381700'));
});
