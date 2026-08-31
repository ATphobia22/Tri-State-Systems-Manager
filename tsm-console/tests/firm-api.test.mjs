import test from 'node:test';
import assert from 'node:assert/strict';
import { getFirmPanelLayers, getFirmPanelManifest } from '../server/geospatial/firm-panel.mjs';

test('FIRM manifest identifies panel and fails closed on georeferencing', () => {
  const manifest = getFirmPanelManifest('18129C0265C');
  assert.equal(manifest.panel_number, '18129C0265C');
  assert.equal(manifest.effective_date, '2014-11-05');
  assert.equal(manifest.georeferencing.status, 'FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE');
  assert.equal(manifest.world_file_candidates.length, 2);
});

test('public FIRM layer endpoint exposes no derived layer while source georeferencing is unvalidated', () => {
  const layers = getFirmPanelLayers('18129C0265C');
  assert.equal(layers.panel_id, '18129C0265C');
  assert.deepEqual(layers.public_layers, []);
  assert.match(layers.blocked_reason, /georeferencing is validated/);
});

test('unknown FIRM panel returns null', () => {
  assert.equal(getFirmPanelManifest('00000A0000A'), null);
  assert.equal(getFirmPanelLayers('00000A0000A'), null);
});
