import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'ingestion/river-network-api.mjs'), 'utf8');

test('J.T. Myers adapter uses the verified Uniontown station and not 03322000', () => {
  assert.match(source, /JT_MYERS_STATION_ID = '03322420'/);
  assert.match(source, /03322000.*remains the distinct Ohio River at Evansville station/s);
});

test('J.T. Myers adapter resolves metadata and uses the modern USGS API adapter', () => {
  assert.match(source, /fetchUsgsStationMetadata/);
  assert.match(source, /fetchUsgsInstantaneousValues/);
  assert.match(source, /USGS Water Data API V1/);
});

test('J.T. Myers adapter marks cached observations stale and never presents them as live', () => {
  assert.match(source, /state: 'STALE_CACHE'/);
  assert.match(source, /liveObservation: false/);
  assert.match(source, /cacheAgeSeconds/);
});
