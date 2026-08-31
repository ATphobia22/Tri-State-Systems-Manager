import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestFirmPanel } from '../server/ingestion/sources/fema-firm-panel.mjs';
import { deriveFirmPanelAsset } from '../server/geospatial/firm-derivatives.mjs';

test('ingestion preserves the source-only state when matching georeferencing is absent', () => {
  const result = ingestFirmPanel('18129C0265C');
  assert.equal(result.ok, true);
  assert.equal(result.validation_status, 'FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE');
  assert.equal(result.derived_assets_available, false);
  assert.equal(result.world_file_candidates.length, 2);
});

test('derivative generation rejects unvalidated FIRM input', () => {
  assert.throws(
    () => deriveFirmPanelAsset({
      panel_id: '18129C0265C',
      derivative_id: 'DER-FIRM-18129C0265C-001',
      validation_status: 'FAILED_CLOSED_MISSING_MATCHING_WORLD_FILE',
      source_evidence_ids: ['EVID-FIRM-18129C0265C'],
      software_version: 'tsm-firm@1.0.0',
    }),
    (error) => error.code === 'FIRM_GEOREFERENCING_NOT_VALIDATED'
  );
});

test('validated derivative carries explicit source lineage', () => {
  const result = deriveFirmPanelAsset({
    panel_id: '18129C0265C',
    derivative_id: 'DER-FIRM-18129C0265C-001',
    validation_status: 'VALIDATED',
    source_evidence_ids: ['EVID-FIRM-18129C0265C'],
    transformation_chain: [{ method: 'ESRI_WORLD_FILE_AFFINE_PIXEL_TO_MAP' }],
    software_version: 'tsm-firm@1.0.0',
  });
  assert.equal(result.authority_class, 'DERIVED');
  assert.deepEqual(result.source_evidence_ids, ['EVID-FIRM-18129C0265C']);
  assert.equal(result.public_release, false);
});
