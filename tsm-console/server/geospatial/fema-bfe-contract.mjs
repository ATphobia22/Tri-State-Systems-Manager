export function assertFirmBfeMatch({ panelId, femaBfeFt, meshBfeFt, verticalDatum = 'NAVD88' }) {
  if (panelId !== '18129C0265C') throw new Error('FEMA BFE contract is scoped to panel 18129C0265C');
  if (verticalDatum !== 'NAVD88') throw new Error('FEMA BFE contract requires NAVD88');
  if (!Number.isFinite(femaBfeFt) || !Number.isFinite(meshBfeFt)) throw new TypeError('FEMA and mesh BFE values must be finite numbers');
  if (Math.abs(femaBfeFt - meshBfeFt) > 0.001) {
    const error = new Error(`FEMA BFE mismatch: FEMA=${femaBfeFt} ft, mesh=${meshBfeFt} ft`);
    error.code = 'FEMA_BFE_MISMATCH';
    throw error;
  }
  return { ok: true, panelId, femaBfeFt, meshBfeFt, verticalDatum, toleranceFt: 0.001 };
}

export function buildFirmBfeEvidence({ panelId, femaBfeFt, sourceEvidenceId, sourceUri, effectiveDate }) {
  if (panelId !== '18129C0265C') throw new Error('unsupported FIRM panel');
  if (!Number.isFinite(femaBfeFt)) throw new TypeError('femaBfeFt must be finite');
  if (!sourceEvidenceId || !sourceUri || !effectiveDate) throw new Error('FEMA BFE evidence provenance is required');
  return {
    panel_id: panelId,
    bfe_ft: femaBfeFt,
    vertical_datum: 'NAVD88',
    source_evidence_id: sourceEvidenceId,
    source_uri: sourceUri,
    effective_date: effectiveDate,
    authority_class: 'REGULATORY_REFERENCE',
    governance_status: 'human_review_required',
  };
}
