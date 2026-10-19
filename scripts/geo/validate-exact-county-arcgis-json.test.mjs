import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const validator = path.join(root, 'scripts/geo/validate-exact-county.mjs');

test('exact-county validator normalizes Esri REST polygon rings before testing containment', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tsm-esri-geometry-'));
  try {
    const boundaryPath = path.join(dir, 'county.geojson');
    const sourcePath = path.join(dir, 'esri-source.json');
    writeFileSync(boundaryPath, JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[[-88, 37], [-87, 37], [-87, 38], [-88, 38], [-88, 37]]],
        },
      }],
    }));
    writeFileSync(sourcePath, JSON.stringify({
      displayFieldName: '',
      geometryType: 'esriGeometryPolygon',
      spatialReference: { wkid: 4326 },
      features: [{
        attributes: { OBJECTID: 1 },
        geometry: {
          rings: [[[-87.8, 37.2], [-87.2, 37.2], [-87.2, 37.8], [-87.8, 37.8], [-87.8, 37.2]]],
          spatialReference: { wkid: 4326 },
        },
      }],
    }));
    const result = spawnSync(process.execPath, [validator, boundaryPath, sourcePath, 'within'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'validated');
    assert.equal(report.featureCount, 1);
    assert.equal(report.validatedFeatureCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
