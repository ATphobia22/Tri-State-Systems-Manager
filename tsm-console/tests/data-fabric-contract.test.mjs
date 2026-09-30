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

test('live hydrologic routes are retired and fail closed with 410', () => {
  const source = read('server/token-proxy.mjs');
  assert.match(source, /RIVER_TELEMETRY_RETIRED/);
  assert.match(source, /\/api\/hydrologic\/live/);
  assert.match(source, /\/api\/hydrologic\/community/);
  assert.match(source, /\/api\/hydrologic\/alerts/);
  assert.match(source, /\/api\/ingest\/usgs/);
  assert.match(source, /\/api\/ingest\/nwps/);
  assert.match(source, /\/api\/ingest\/hydrologic/);
  assert.doesNotMatch(source, /if \(source === 'noaa'\)/);
  assert.doesNotMatch(source, /fetchNoaaStageFlow\(\{ identifier: nwsId/);
  assert.doesNotMatch(source, /fetchUsgsInstantaneousValues\(\{ stationIds/);
  assert.doesNotMatch(source, /fetchRiverNetwork\(/);
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
