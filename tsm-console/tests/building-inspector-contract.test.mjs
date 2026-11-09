import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('all Posey buildings can be clicked and inspected through a dedicated panel', () => {
  const view = read('../src/components/TriStateDigitalTwinMap.tsx');
  assert.ok(view.includes('setSelectedBuilding(props)'));
  assert.ok(view.includes('<BuildingInspectionPanel properties={selectedBuilding}'));
  assert.ok(view.includes('indiana-buildings-extrusion'));
  assert.ok(view.includes('indiana-buildings-footprint'));
  assert.ok(view.includes('selectedBuilding &&'));
});

test('Posey map is no longer clipped to the Mount Vernon pilot envelope', () => {
  const view = read('../src/components/TriStateDigitalTwinMap.tsx');
  assert.ok(view.includes('[-88.13, 37.72]'));
  assert.ok(view.includes('[-87.64, 38.28]'));
});

test('building detail panel displays provenance and never invents a street address', () => {
  const panel = read('../src/components/BuildingInspectionPanel.tsx');
  assert.ok(panel.includes('Address not verified'));
  assert.ok(panel.includes("tsm_address_status === 'MATCHED_OFFICIAL_POINT'"));
  assert.ok(panel.includes('Indiana GIO footprint record'));
  assert.ok(panel.includes('Indiana GIO address-points dataset (2025)'));
  assert.ok(panel.includes('Object.entries(properties)'));
  assert.ok(panel.includes("/^tsm_[a-z0-9_]+$/i.test(key)"));
  assert.ok(panel.includes("['objectid', 'OBJECTID', 'igio_objectid']"));
  assert.ok(panel.includes('Not available'));
  assert.ok(panel.includes('not verified LiDAR roof measurements'));
});

test('all installed visual volumes remain LoD1 estimated until measured models exist', () => {
  const style = read('../src/lib/posey-screening-building-style.ts');
  assert.ok(style.includes('LoD1_ESTIMATED'));
  assert.ok(style.includes('SCREENING_ONLY'));
  assert.ok(style.includes('tsm_visual_height_m'));
  assert.ok(style.includes('minzoom: 12'));
  assert.ok(!style.includes("['get', 'height_m']"));
});
