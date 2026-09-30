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

test('Indiana imagery and 3DEP layers use ImageServer exportImage, not WMS', () => {
  // Verified 2026-09-30: Indiana_Current_Imagery exposes no WMSServer
  // endpoint (404 "Invalid URL"); exportImage is the working tile access.
  // 3DEP hillshade uses the service's official "Hillshade Gray" rendering
  // rule (verified live against rasterFunctionInfos).
  const ui = read('src/components/RealWorldTwinMap.tsx');
  const wms = read('src/lib/open-world-wms.ts');
  assert.match(wms, /export function buildArcGisImageServerExportTemplate/);
  assert.match(wms, /USGS_3DEP_HILLSHADE_RENDERING_RULE/);
  assert.match(wms, /"rasterFunction":"Hillshade Gray"/);
  assert.match(ui, /buildArcGisImageServerExportTemplate\(INDIANA_CURRENT_IMAGERY_WMS\)/);
  assert.match(ui, /buildArcGisImageServerExportTemplate\(USGS_3DEP_ELEVATION_WMS, USGS_3DEP_HILLSHADE_RENDERING_RULE\)/);
  assert.doesNotMatch(ui, /buildArcGisWmsTileTemplate/);
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
  assert.match(source, /if \(!terrain\.enabled\)/);
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

test('live stage telemetry is retired: no polling, gates stay blocked', () => {
  const source = read('src/lib/stage.ts');
  // Owner decision 2026-09-29 ("drop live river data"): the module must not
  // perform any network I/O or reference live hydrologic endpoints.
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /\/api\/hydrologic\/live/);
  assert.doesNotMatch(source, /waterservices\.usgs\.gov/);
  assert.doesNotMatch(source, /waterdata\.usgs\.gov/);
  // The retired sentinel keeps the evidence gates fail-closed.
  assert.match(source, /RETIRED_STAGE/);
  assert.match(source, /REQUIRES_VALIDATED_HYDRAULIC_PROFILE/);
  assert.match(source, /BLOCKED_UNTIL_SITE_WSE_TRANSFER_VALIDATED/);
  assert.match(source, /source: 'UNAVAILABLE'/);
});
