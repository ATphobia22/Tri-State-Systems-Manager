import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const twin = readFileSync(new URL('../src/routes/TwinCanvasView.tsx', import.meta.url), 'utf8');
const layers = readFileSync(new URL('../src/lib/map-layers.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('TwinCanvas uses the real Indiana imagery and MapLibre terrain contract', () => {
  assert.match(twin, /RealWorldTwinMap/);
  assert.match(layers, /Indiana_Current_Imagery\/ImageServer/);
  assert.match(layers, /raster-dem/);
  assert.match(twin, /setTerrain/);
});

test('flood authorities remain distinct in the twin', () => {
  assert.match(layers, /fema-nfhl/);
  assert.match(layers, /indiana-bafm/);
  assert.match(twin, /FEMA NFHL/);
  assert.match(twin, /BAFM/);
});

test('production twin does not retain synthetic Three.js terrain primitives', () => {
  assert.doesNotMatch(twin, /<planeGeometry/);
  assert.doesNotMatch(twin, /<boxGeometry/);
  assert.doesNotMatch(twin, /<sphereGeometry/);
});

test('twin exposes engineering constants and simulation authority', () => {
  assert.match(twin, /377\.2/);
  assert.match(twin, /375\.0/);
  assert.match(twin, /379\.8/);
  assert.match(twin, /382\.5/);
  assert.match(twin, /SIMULATION_DEMO/);
});

test('build keeps MapLibre available to the browser bundle', () => {
  assert.equal(typeof packageJson.dependencies['maplibre-gl'], 'string');
});
