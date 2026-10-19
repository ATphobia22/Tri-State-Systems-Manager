import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Indiana data catalog is wired to authoritative source classes and contains no clinical integration', () => {
  const catalog = JSON.parse(read('../data/schemas/tsm-indiana-data-catalog-v1.json'));
  assert.equal(catalog.version, '1.4.0');
  const ids = new Set(catalog.sources.map((source) => source.id));
  for (const required of ['usgs-waterdata-apis', 'noaa-nwps-api', 'fema-nfhl', 'indiana-bafm', 'usace-nld', 'usgs-tnm-access']) assert.ok(ids.has(required), `missing ${required}`);
  assert.ok(catalog.sources.some((source) => source.url?.includes('Parcel_Boundaries_of_Indiana_2025/FeatureServer')));
  assert.doesNotMatch(JSON.stringify(catalog), /\bHIPAA\b|\bPHI\b|\bIRB\b|\bClinicalResearch\b/i);
});

test('on-demand hydrology snapshots use the server-side source adapter and remain rate-limited', () => {
  const source = read('server/token-proxy.mjs');
  assert.match(source, /fetchRiverNetwork/);
  assert.match(source, /loadRiverStationRegistry/);
  assert.match(source, /\/api\/hydrologic\/community/);
  assert.match(source, /\/api\/hydrologic\/live/);
  assert.match(source, /checkRouteRateLimit\(req, res, requestId\)/);
  assert.match(source, /automatic polling is prohibited/);
  assert.match(source, /\/api\/hydrologic\/alerts/);
  assert.match(source, /\/api\/ingest\/usgs/);
  assert.match(source, /\/api\/ingest\/nwps/);
  assert.match(source, /\/api\/ingest\/hydrologic/);
  assert.doesNotMatch(source, /if \(source === 'noaa'\)/);
});

test('USGS provisional qualifier is preserved in normalized records', () => {
  const source = read('server/ingestion/usgs-nwis.mjs');
  assert.match(source, /qualifier\b/);
  assert.match(source, /approvalStatus/);
  assert.match(source, /provisional/);
});

test('2025 Indiana parcel FeatureServer is the primary parcel layer', () => {
  const source = read('src/lib/map-layers.ts');
  assert.match(source, /Indiana Parcel Boundaries 2025/);
  assert.match(source, /Parcel_Boundaries_of_Indiana_2025\/FeatureServer/);
});

test('current Indiana imagery is registered in the runtime geospatial source plane', () => {
  const source = read('src/lib/map-layers.ts');
  assert.match(source, /Indiana_Current_Imagery\/ImageServer/);
  assert.match(source, /Indiana Current Imagery/);
});


test('NOAA forecasts are exposed on demand as a distinct data class', () => {
  const server = read('server/token-proxy.mjs');
  const adapter = read('server/ingestion/river-network-api.mjs');
  assert.match(server, /\/api\/hydrologic\/forecast/);
  assert.match(server, /fetchRiverForecasts/);
  assert.match(server, /hydrologicForecastLimiter/);
  assert.match(adapter, /dataClass: 'forecast'/);
  assert.match(adapter, /validAt: record\.observedAt/);
  assert.match(adapter, /never written to the observed-stage field/);
});

test('USGS raw gage height is kept separate from NAVD88 station altitude metadata', () => {
  const registry = JSON.parse(read('../artifacts/tsm-river-valley-realtime-stations-v1.json'));
  for (const stationId of ['03293551', '03381700']) {
    const station = registry.verified_observation_stations.find((item) => item.station_id === stationId);
    assert.ok(station, `missing station ${stationId}`);
    assert.equal(station.vertical_datum, 'SOURCE_GAGE_DATUM');
    assert.equal(station.station_altitude_vertical_datum, 'NAVD88');
    assert.equal(typeof station.station_altitude_ft_navd88, 'number');
    assert.equal(Object.hasOwn(station, 'datum_ft_navd88'), false);
  }
  const oldShawneetown = registry.verified_observation_stations.find((item) => item.station_id === '03381700');
  assert.equal(oldShawneetown.latitude, 37.6925);
  assert.equal(oldShawneetown.longitude, -88.1347222222222);
  assert.equal(oldShawneetown.station_altitude_ft_navd88, 309.1);
});
