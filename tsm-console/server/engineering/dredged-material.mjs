const REQUIRED_TESTS = [
  'grain_size_distribution',
  'moisture_content',
  'compaction_characteristics',
  'shear_strength',
  'consolidation',
  'environmental_testing',
  'chain_of_custody',
];

export function evaluateMaterialQualification(input) {
  if (!input || typeof input !== 'object') throw new TypeError('material record is required');
  const missing = REQUIRED_TESTS.filter((field) => input.required?.[field] !== true);
  const structuralFillEligible = missing.length === 0 && typeof input.reviewer_role === 'string' && input.reviewer_role.length > 0;
  return {
    material_id: input.material_id,
    review_state: structuralFillEligible ? 'ENGINEERING_REVIEW_READY' : 'TESTING_REQUIRED',
    structural_fill_eligible: structuralFillEligible,
    missing_evidence: missing,
    agency_acceptance: false,
  };
}

export function validateMaterialBalance({ source, allocated, processingLoss = 0, placed, remaining }) {
  const values = { source, allocated, processingLoss, placed, remaining };
  if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
    return { ok: false, error: 'MATERIAL_BALANCE_INVALID_NONNEGATIVE_VALUES' };
  }
  if (allocated > source) return { ok: false, error: 'MATERIAL_BALANCE_ALLOCATED_EXCEEDS_SOURCE' };
  const expectedRemaining = source - processingLoss - placed;
  if (Math.abs(expectedRemaining - remaining) > 1e-6) {
    return { ok: false, error: 'MATERIAL_BALANCE_CONSERVATION_FAILURE' };
  }
  if (placed + processingLoss > allocated) return { ok: false, error: 'MATERIAL_BALANCE_PLACEMENT_EXCEEDS_ALLOCATION' };
  return { ok: true, error: null };
}
