import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('real-source twin uses supported ArcGIS ImageServer export-image requests', () => {
  const source = read('src/lib/twin-map-style.ts');
  assert.match(source, /export\?bbox=\{bbox-epsg-3857\}/);
  assert.doesNotMatch(source, /Indiana_Current_Imagery\/ImageServer\/tile\/\{z\}/);
});

test('FEMA NFHL and Indiana BAFM remain distinct authority planes', () => {
  const source = read('src/lib/twin-map-style.ts');
  const ui = read('src/components/RealWorldTwinMap.tsx');
  assert.match(source, /fema-nfhl/);
  assert.match(source, /indiana-bafm/);
  assert.match(ui, /FEMA NFHL: effective \/ insurance/);
  assert.match(ui, /Indiana BAFM: planning \/ Flood Control Act/);
});

test('terrain is fail-closed when no real Terrain-RGB endpoint is configured', () => {
  const source = read('src/lib/twin-map-style.ts');
  assert.match(source, /VITE_TSM_TERRAIN_RGB_URL_TEMPLATE/);
  assert.match(source, /if \(!terrainTemplate\) return false/);
  assert.doesNotMatch(source, /synthetic|mock.*terrain|new Terrain\(/i);
});

test('operational UI preserves human authority and simulation evidence limits', () => {
  const source = read('src/components/RealWorldTwinMap.tsx');
  const view = read('src/routes/TwinCanvasView.tsx');
  assert.match(view, /Human authority remains final/i);
  assert.match(source, /SIMULATION_DEMO \/ MODEL_OUTPUT/);
  assert.match(source, /Visualization\/model context only/);
});

test('TSM contains an explicit government peer-review boundary', () => {
  const compliance = read('../COMPLIANCE.md');
  assert.match(compliance, /human|agency/i);
  assert.match(compliance, /FEMA|USACE|Indiana|DNR/i);
  assert.match(compliance, /not.*certif|cannot.*certif|does not.*certif/i);
});

test('NOAA and USGS live stage both use the verified gage datum for WSE conversion', () => {
  const source = read('src/lib/stage.ts');
  assert.match(source, /const conversion = value != null \? convertGageHeightToNavd88/);
  assert.doesNotMatch(source, /record\.source === 'USGS' && value != null \?/);
});
