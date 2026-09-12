import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Indiana data catalog is wired to authoritative source classes and contains no clinical integration', () => {
  const catalog = JSON.parse(read('../data/schemas/tsm-indiana-data-catalog-v1.json'));
  assert.equal(catalog.version, '1.1.0');
  const ids = new Set(catalog.sources.map((source) => source.id));
  for (const required of ['usgs-waterdata-apis', 'noaa-nwps-api', 'fema-nfhl', 'indiana-bafm', 'usace-nld', 'indiana-parcels-harvest', 'usgs-tnm-access']) assert.ok(ids.has(required), `missing ${required}`);
  assert.doesNotMatch(JSON.stringify(catalog), /\bHIPAA\b|\bPHI\b|\bIRB\b|\bClinicalResearch\b/i);
});

test('live hydrologic path uses NOAA observed first and USGS as fallback', () => {
  const source = read('server/token-proxy.mjs');
  assert.match(source, /source === 'noaa' \? await fetchNoaaStageFlow/);
  assert.match(source, /source === 'auto'/);
  assert.match(source, /catch \(noaaError\)/);
  assert.match(source, /fetchUsgsInstantaneousValues/);
});

test('USGS provisional qualifier is preserved in normalized records', () => {
  const source = read('server/ingestion/usgs-nwis.mjs');
  assert.match(source, /qualifier:/);
  assert.match(source, /approvalStatus/);
});

test('current Indiana parcel FeatureServer is the primary parcel layer', () => {
  const source = read('src/lib/map-layers.ts');
  assert.match(source, /Parcel Boundaries of Indiana Current/);
  assert.match(source, /Parcel_Boundaries_of_Indiana_Current\/FeatureServer/);
});
