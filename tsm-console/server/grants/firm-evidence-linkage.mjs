export function linkFirmEvidenceToProject(panelId, projectId) {
  if (!/^\d{5}[A-Z]\d{4}[A-Z]$/.test(panelId)) throw new TypeError('invalid FEMA FIRM panel identifier');
  if (!projectId || typeof projectId !== 'string') throw new TypeError('projectId is required');

  return {
    link_id: `FIRM-LINK:${panelId}:${projectId}`,
    panel_id: panelId,
    project_id: projectId,
    evidence_role: 'SOURCE_REFERENCE',
    supported_claims: ['panel_identity', 'published_map_reference'],
    unsupported_claims: ['current_parcel_zone', 'permit_eligibility', 'grant_eligibility', 'engineering_certification'],
    human_review_required: true,
  };
}

export function evaluateFirmEvidenceAvailability(panelId, manifest) {
  if (!manifest || manifest.panel_number !== panelId) {
    return { available: false, reason: 'FIRM source manifest unavailable' };
  }

  return {
    available: true,
    panel_id: panelId,
    source_only: manifest.georeferencing.status !== 'VALIDATED',
    human_review_required: true,
    reason: manifest.georeferencing.status === 'VALIDATED'
      ? 'validated source available; apply current regulatory rule set before conclusions'
      : 'source evidence available; georeferencing is not validated for derived spatial analysis',
  };
}
