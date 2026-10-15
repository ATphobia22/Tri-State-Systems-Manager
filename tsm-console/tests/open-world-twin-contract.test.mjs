import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const twin = readFileSync(new URL('../src/routes/TwinCanvasView.tsx', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/components/RealWorldTwinMap.tsx', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/lib/twin-map-style.ts', import.meta.url), 'utf8');
const layers = readFileSync(new URL('../src/lib/map-layers.ts', import.meta.url), 'utf8');
const catalog = JSON.parse(readFileSync(new URL('../../data/sources/noaa-cloudgis-catalog.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const productionTwin = [twin, renderer, style].join('\n');

test('TwinCanvas uses the real Indiana imagery and MapLibre terrain contract', () => {
  assert.match(twin, /RealWorldTwinMap/);
  assert.ok(layers.includes('Indiana_Current_Imagery/ImageServer'));
  assert.match(layers, /raster-dem/);
  assert.match(productionTwin, /setTerrain/);
});

test('flood authorities remain distinct in the twin', () => {
  assert.match(layers, /fema-nfhl/);
  assert.match(layers, /indiana-bafm/);
  assert.match(productionTwin, /FEMA NFHL/);
  assert.match(productionTwin, /BAFM/);
});

test('NOAA CloudGIS overlays are opt-in, attributed, and separate from flood authority layers', () => {
  assert.ok(renderer.includes('noaa-cloudgis-warnings-layer'));
  assert.ok(renderer.includes('noaa-cloudgis-radar-layer'));
  assert.ok(renderer.includes("visibility: 'none'"));
  assert.ok(renderer.includes('NOAA/National Weather Service CloudGIS'));
  assert.ok(renderer.includes('NOAA/NWS Multi-Radar'));
  assert.ok(renderer.includes('NWS Warnings'));
  assert.ok(renderer.includes('NOAA Radar'));
  assert.equal(catalog.layers.length, 3);
  assert.equal(catalog.layers.every((layer) => layer.enabled_by_default === false), true);
  assert.equal(catalog.status, 'CAPABILITIES_RETRIEVED_GETMAP_RUNTIME_PENDING');
  assert.ok(catalog.layers.every((layer) => layer.capabilities_url.startsWith('https://opengeo.ncep.noaa.gov/geoserver/')));
});

test('production twin does not retain synthetic Three.js terrain primitives', () => {
  assert.doesNotMatch(productionTwin, /<planeGeometry/);
  assert.doesNotMatch(productionTwin, /<boxGeometry/);
  assert.doesNotMatch(productionTwin, /<sphereGeometry/);
});

test('twin rejects stale global engineering constants and preserves simulation authority', () => {
  for (const value of ['377.2', '375.0', '379.8', '382.5']) {
    assert.doesNotMatch(productionTwin, new RegExp(value.replace('.', '\\\\.')));
  }
  assert.match(productionTwin, /SIMULATION_DEMO/);
  assert.match(productionTwin, /source required|unavailable|verified datum conversion required/i);
});

test('build keeps MapLibre available to the browser bundle', () => {
  assert.equal(typeof packageJson.dependencies['maplibre-gl'], 'string');
});
