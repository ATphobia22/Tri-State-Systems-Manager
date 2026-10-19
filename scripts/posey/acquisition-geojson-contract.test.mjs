import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const acquisition = readFileSync(
  path.join(root, 'scripts/posey/download-offline-authoritative-data.ps1'),
  'utf8',
);
const validator = path.join(root, 'scripts/geo/validate-exact-county.mjs');

test('ArcGIS county acquisitions request GeoJSON and reject Esri JSON shapes', () => {
  const start = acquisition.indexOf('function Save-ArcGisWithinCounty(');
  const end = acquisition.indexOf('function Save-IndianaBuildingFootprints()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const functionSource = acquisition.slice(start, end);
  assert.match(functionSource, /resultType="standard"; f="geojson"/);
  assert.match(functionSource, /r\.type -ne "FeatureCollection"/);
  assert.match(functionSource, /feature\.geometry\.type -notin/);
});

test('independent county validator accepts GeoJSON geometry, not Esri rings objects', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tsm-posey-geojson-'));
  try {
    const boundaryPath = path.join(directory, 'boundary.geojson');
    const sourcePath = path.join(directory, 'source.geojson');
    const esriPath = path.join(directory, 'esri-json.geojson');
    const ring = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]];
    writeFileSync(boundaryPath, JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    }));
    writeFileSync(sourcePath, JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { source_id: 'fixture' },
        geometry: { type: 'Polygon', coordinates: [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]] },
      }],
    }));
    writeFileSync(esriPath, JSON.stringify({
      type: 'FeatureCollection',
      features: [{ attributes: { OBJECTID: 1 }, geometry: { rings: [ring] } }],
    }));

    const valid = spawnSync(process.execPath, [validator, boundaryPath, sourcePath, 'intersects'], { encoding: 'utf8' });
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);
    assert.match(valid.stdout, /"status": "validated"/);

    const invalid = spawnSync(process.execPath, [validator, boundaryPath, esriPath, 'intersects'], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
