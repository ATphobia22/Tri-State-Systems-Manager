import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createPoseyScreeningExtrusionLayer } from '../src/lib/posey-screening-building-style.ts';

test('Posey screening style never consumes unqualified height_m', () => {
  const layer = createPoseyScreeningExtrusionLayer('indiana-buildings');
  assert.equal(layer.type, 'fill-extrusion');
  assert.equal(layer.layout.visibility, 'none');
  const json = JSON.stringify(layer);
  assert.ok(json.includes('tsm_visual_height_m'));
  assert.ok(json.includes('SCREENING_ONLY'));
  assert.ok(json.includes('LoD1_ESTIMATED'));
  assert.ok(json.includes('tsm_height_evidence'));
  assert.equal(json.includes('"height_m"'), false);
  assert.equal(json.includes('NAVD88'), false);
});

test('screening style never allows estimated visual source to claim engineer approval', () => {
  const layer = createPoseyScreeningExtrusionLayer('screening', 'screening-test');
  assert.deepEqual(layer.filter, [
    'all',
    ['==', ['get', 'tsm_visual_mode'], 'SCREENING_ONLY'],
    ['==', ['get', 'tsm_geometry_lod'], 'LoD1_ESTIMATED'],
    ['==', ['get', 'tsm_engineering_approved'], false],
    ['has', 'tsm_visual_height_m'],
  ]);
  assert.deepEqual(layer.paint['fill-extrusion-base'], ['get', 'tsm_visual_base_m']);
});

test('map component no longer treats IGIO raw height_m as a measured extrusion height', () => {
  const source = readFileSync(new URL('../src/components/TriStateDigitalTwinMap.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('createPoseyScreeningExtrusionLayer(screenedSourceId'));
  assert.ok(source.includes('VITE_TSM_POSEY_SCREENING_GEOJSON_PATH'));
  assert.ok(source.includes("screeningRelative.includes('..')"));
  assert.ok(source.includes('NOT SURVEYED'));
  assert.ok(source.includes("const screenedSourceId = 'tsm-posey-screening-buildings'"));
  assert.equal(source.includes("['get', 'height_m']"), false);
});

test('empty style source ID is rejected', () => {
  assert.throws(() => createPoseyScreeningExtrusionLayer('  '), /identifier missing/);
});
