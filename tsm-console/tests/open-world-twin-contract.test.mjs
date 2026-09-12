import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const twin = readFileSync(new URL('../src/routes/TwinCanvasView.tsx', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/components/RealWorldTwinMap.tsx', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/lib/twin-map-style.ts', import.meta.url), 'utf8');
const layers = readFileSync(new URL('../src/lib/map-layers.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const productionTwin = `${twin}\n${renderer}\n${style}`;

test('TwinCanvas uses the real Indiana imagery and MapLibre terrain contract', () => {
  assert.match(twin, /RealWorldTwinMap/);
  assert.match(layers, /Indiana_Current_Imagery\/ImageServer/);
  assert.match(layers, /raster-dem/);
  assert.match(productionTwin, /setTerrain/);
});

test('flood authorities remain distinct in the twin', () => {
  assert.match(layers, /fema-nfhl/);
  assert.match(layers, /indiana-bafm/);
  assert.match(productionTwin, /FEMA NFHL/);
  assert.match(productionTwin, /BAFM/);
});

test('production twin does not retain synthetic Three.js terrain primitives', () => {
  assert.doesNotMatch(productionTwin, /<planeGeometry/);
  assert.doesNotMatch(productionTwin, /<boxGeometry/);
  assert.doesNotMatch(productionTwin, /<sphereGeometry/);
});

test('twin exposes engineering constants and simulation authority', () => {
  for (const value of ['377.2', '375.0', '379.8', '382.5']) assert.match(productionTwin, new RegExp(value.replace('.', '\\.')));
  assert.match(productionTwin, /SIMULATION_DEMO/);
});

test('build keeps MapLibre available to the browser bundle', () => {
  assert.equal(typeof packageJson.dependencies['maplibre-gl'], 'string');
});
