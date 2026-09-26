import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRasResultsPayload, buildRasResultsArtifact } from './ras-results.mjs';

function validPayload() {
  return {
    meta: {
      plan_id: 'posey-q100',
      source: 'geotiff:depth.tif',
      content_hash_sha256: 'a'.repeat(64),
      model_note: 'stride 8x8 from 1024x1024',
      units: 'feet',
      gage_id: '03378500',
      authority_class: 'DERIVATION',
      derivation_class: 'HEC_RAS_DEPTH_DOWNSAMPLE',
      is_simulation_demo: false,
      horizontal_crs_note: 'Record native GeoTIFF CRS from RAS Mapper; analysis frame remains EPSG:2966 / NAVD88',
    },
    cells: [
      { id: 'posey-q100_0_0', x_native: 100.5, y_native: 200.5, lon: 100.5, lat: 200.5, depth_ft: 2.5 },
      { id: 'posey-q100_8_0', x_native: 108.5, y_native: 200.5, lon: 108.5, lat: 200.5, depth_ft: 0.0 },
    ],
    bfe_navd88_ft: 375.0,
    lag_navd88_ft: 377.2,
  };
}

test('ras-results accepts a valid ingest payload', () => {
  const summary = validateRasResultsPayload(validPayload());
  assert.equal(summary.plan_id, 'posey-q100');
  assert.equal(summary.cell_count, 2);
  assert.equal(summary.content_hash_sha256, 'a'.repeat(64));
});

test('ras-results rejects missing meta.plan_id', () => {
  const body = validPayload();
  body.meta.plan_id = '';
  assert.throws(() => validateRasResultsPayload(body), /plan_id/);
});

test('ras-results rejects malformed content hash', () => {
  const body = validPayload();
  body.meta.content_hash_sha256 = 'not-a-hash';
  assert.throws(() => validateRasResultsPayload(body), /content_hash_sha256/);
});

test('ras-results rejects empty cells array', () => {
  const body = validPayload();
  body.cells = [];
  assert.throws(() => validateRasResultsPayload(body), /cells/);
});

test('ras-results rejects negative depth', () => {
  const body = validPayload();
  body.cells[0].depth_ft = -1;
  assert.throws(() => validateRasResultsPayload(body), /depth_ft/);
});

test('ras-results rejects non-finite BFE', () => {
  const body = validPayload();
  body.bfe_navd88_ft = NaN;
  assert.throws(() => validateRasResultsPayload(body), /bfe_navd88_ft/);
});

test('ras-results artifact is MODEL_OUTPUT pending human review', () => {
  const body = validPayload();
  const summary = validateRasResultsPayload(body);
  const artifact = buildRasResultsArtifact(summary, body);
  assert.equal(artifact.authority_class, 'MODEL_OUTPUT');
  assert.equal(artifact.human_review_status, 'pending');
  assert.equal(artifact.horizontal_crs, 'EPSG:2966');
  assert.equal(artifact.vertical_datum, 'NAVD88');
  assert.match(artifact.notes, /not a regulatory determination/i);
});
