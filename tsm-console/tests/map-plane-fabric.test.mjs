import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fabric = fs.readFileSync(new URL('../src/lib/map-plane-fabric.ts', import.meta.url), 'utf8');

test('MapLibre plane defines twelve source planes', () => {
  assert.equal((fabric.match(/index: \d+/g) ?? []).length, 12);
  assert.match(fabric, /VITE_TSM_TERRAIN_RGB_URL_TEMPLATE/);
  assert.match(fabric, /hazards\.fema\.gov/);
  assert.match(fabric, /gisdata\.in\.gov/);
  assert.match(fabric, /di-ingov\.img\.arcgis\.com/);
  assert.match(fabric, /tile\.openstreetmap\.org/);
});

test('engineering API is not auto-executed by the visualization plane', () => {
  assert.match(fabric, /never auto-posted by the map/);
  assert.match(fabric, /api\/engineering\/ras-results/);
});
