export function deriveFirmPanelAsset(input) {
  if (!input || input.validation_status !== 'VALIDATED') {
    const error = new Error('fail-closed: FIRM source georeferencing must be validated before derivative generation');
    error.code = 'FIRM_GEOREFERENCING_NOT_VALIDATED';
    throw error;
  }

  if (!Array.isArray(input.source_evidence_ids) || input.source_evidence_ids.length === 0) {
    const error = new Error('fail-closed: derivative requires at least one source evidence ID');
    error.code = 'FIRM_SOURCE_EVIDENCE_REQUIRED';
    throw error;
  }

  return {
    panel_id: input.panel_id,
    derivative_id: input.derivative_id,
    authority_class: 'DERIVED',
    derivation_class: 'DERIVED_FIRM_GEOTRANSFORM',
    source_evidence_ids: [...input.source_evidence_ids],
    transformation_chain: Array.isArray(input.transformation_chain) ? [...input.transformation_chain] : [],
    software_version: input.software_version,
    validation_status: 'pending',
    public_release: false,
  };
}
