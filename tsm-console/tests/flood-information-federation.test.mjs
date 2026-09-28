import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFloodInformationResult,
  validateFloodInformationResult,
  toEvidenceArtifactFields,
} from '../server/ingestion/flood-information-federation.mjs';

const base = {
  result_id: 'FLOOD-TEST-001',
  dataset_id: 'FEMA-NFHL',
  source_authority: 'FEMA',
  source_uri: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
  source_version: 'NFHL-current',
  retrieved_at: '2026-09-28T02:00:00Z',
  published_at: null,
  regulatory_status: 'FEMA_EFFECTIVE',
  authority_class: 'FEDERAL_REGULATORY_REFERENCE',
  horizontal_crs: 'EPSG:4269',
  vertical_datum: 'NAVD88',
  model_lineage: [],
  software_version: 'tsm-flood-federation@1.0.0',
  uncertainty: {
    status: 'qualitative',
    method: 'source-published limitations',
    notes: 'Source product uncertainty is not replaced by TSM.',
  },
  insurance_determination_eligible: true,
  human_review_required: true,
  human_review_status: 'pending',
  transformation_chain: [],
  content_hash_sha256: null,
};

test('requires every mandatory flood provenance field', () => {
  for (const field of [
    'source_authority',
    'regulatory_status',
    'horizontal_crs',
    'vertical_datum',
    'model_lineage',
    'retrieved_at',
    'software_version',
    'uncertainty',
  ]) {
    const invalid = { ...base };
    delete invalid[field];
    assert.throws(() => validateFloodInformationResult(invalid), new RegExp(field.replaceAll('.', '\\.'), 'i'));
  }
});

test('builds deterministic provenance hash', () => {
  const a = buildFloodInformationResult(base);
  const b = buildFloodInformationResult(base);
  assert.equal(a.provenance_hash_sha256, b.provenance_hash_sha256);
  assert.match(a.provenance_hash_sha256, /^[a-f0-9]{64}$/);
});

test('blocks BAFM from being used as FEMA insurance evidence', () => {
  assert.throws(
    () => validateFloodInformationResult({
      ...base,
      dataset_id: 'IDNR-BAFL',
      source_authority: 'Indiana DNR Division of Water',
      regulatory_status: 'IDNR_BEST_AVAILABLE',
      authority_class: 'STATE_BEST_AVAILABLE',
      insurance_determination_eligible: true,
    }),
    /insurance-determination/i,
  );
});

test('blocks USGS inundation from being used as insurance evidence', () => {
  assert.throws(
    () => validateFloodInformationResult({
      ...base,
      dataset_id: 'USGS-FLOOD-INUNDATION',
      source_authority: 'USGS',
      regulatory_status: 'USGS_INUNDATION',
      authority_class: 'OBSERVATION',
      insurance_determination_eligible: true,
    }),
    /insurance-determination/i,
  );
});

test('model output requires human review and preserves model lineage', () => {
  const result = buildFloodInformationResult({
    ...base,
    dataset_id: 'HEC-RAS-PROPOSED',
    source_authority: 'TSM Engineering Model',
    source_version: 'project-2026-09-28',
    regulatory_status: 'MODEL_EVIDENCE',
    authority_class: 'MODEL_OUTPUT',
    model_lineage: [{
      model_id: 'POSEY-HECRAS-001',
      role: 'hydraulic_model',
      model_version: 'HEC-RAS-5.0.7',
      source_artifact_ids: ['ART-TERRAIN-1', 'ART-BATHY-1'],
    }],
    insurance_determination_eligible: false,
    human_review_required: true,
  });
  assert.equal(result.model_lineage[0].model_id, 'POSEY-HECRAS-001');
  const artifact = toEvidenceArtifactFields(result);
  assert.equal(artifact.governance_status, 'human_review_required');
  assert.deepEqual(artifact.parent_artifacts, ['ART-TERRAIN-1', 'ART-BATHY-1']);
});

test('rejects quantified uncertainty without value and units', () => {
  assert.throws(
    () => validateFloodInformationResult({
      ...base,
      uncertainty: { status: 'quantified', method: 'RMSE', notes: 'test' },
    }),
    /quantified uncertainty/i,
  );
});
