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

test('live stage telemetry is button-only: no auto-fetch, no polling, gates stay blocked', () => {
  const source = read('src/lib/stage.ts');
  const router = read('src/lib/router.tsx');
  // Owner direction 2026-10-01 (SUPERSEDING the 2026-09-29 retirement):
  // live values ONLY via a user-initiated "Fetch live snapshot" button.
  // Page loaders must not perform network I/O.
  assert.doesNotMatch(router, /fetchLiveStage\(\)/);
  assert.match(router, /unavailableStage\(\)/);
  // The module exposes exactly one explicit live path, for button presses.
  assert.match(source, /export async function fetchLiveStage/);
  assert.match(source, /export function unavailableStage/);
  assert.match(source, /call ONLY from an explicit user button press/);
  // No polling, periodic timers, or background refresh anywhere in the live path.
  // (The single fetch carries a 15s AbortController timeout — that is a
  // request timeout, not a polling timer.)
  assert.doesNotMatch(source, /setInterval/);
  assert.doesNotMatch(source, /requestAnimationFrame/);
  // USGS source binding with provisional qualifier and fail-closed gates.
  assert.match(source, /waterservices\.usgs\.gov/);
  assert.match(source, /qualifier: 'P'|qualifier: null/);
  assert.match(source, /REQUIRES_VALIDATED_HYDRAULIC_PROFILE/);
  assert.match(source, /NOT_ELIGIBLE_UNVERIFIED_SITE_TRANSFER/);
  assert.match(source, /source: 'UNAVAILABLE'/);
});
