import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMaterialQualification, validateMaterialBalance } from './dredged-material.mjs';

test('unqualified dredged material cannot be accepted as structural fill', () => {
  const result = evaluateMaterialQualification({
    material_id: 'DM-001',
    source_dredging_project: 'USACE-navigation-project',
    required: {
      grain_size_distribution: true,
      moisture_content: true,
      compaction_characteristics: true,
      shear_strength: true,
      consolidation: true,
      environmental_testing: true,
      chain_of_custody: true,
    },
  });
  assert.equal(result.review_state, 'TESTING_REQUIRED');
  assert.equal(result.structural_fill_eligible, false);
});

test('fully documented material may reach engineering review without implying agency acceptance', () => {
  const result = evaluateMaterialQualification({
    material_id: 'DM-002',
    source_dredging_project: 'USACE-navigation-project',
    required: {
      grain_size_distribution: true,
      moisture_content: true,
      compaction_characteristics: true,
      shear_strength: true,
      consolidation: true,
      environmental_testing: true,
      chain_of_custody: true,
    },
    reviewer_role: 'qualified_geotechnical_reviewer',
  });
  assert.equal(result.review_state, 'ENGINEERING_REVIEW_READY');
  assert.equal(result.structural_fill_eligible, true);
  assert.notEqual(result.review_state, 'AGENCY_ACCEPTED');
});

test('material routing conserves volume and rejects impossible balances', () => {
  assert.deepEqual(validateMaterialBalance({ source: 1000, allocated: 800, processingLoss: 50, placed: 700, remaining: 250 }), { ok: true, error: null });
  assert.equal(validateMaterialBalance({ source: 1000, allocated: 900, processingLoss: 50, placed: 700, remaining: 250 }).ok, false);
});
