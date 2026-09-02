/**
 * Jurisdiction policy engine with source citations
 * Policies are versioned and never silently applied as determinations.
 * Human governance_status required for regulatory effect.
 */

export const POLICIES = [
  {
    id: 'IN-FLOOD-CONTROL-ACT',
    jurisdiction: 'Indiana',
    title: 'Indiana Flood Control Act — construction in floodway',
    citation: 'IC 14-28-1',
    source_uri: 'https://www.in.gov/dnr/water/',
    authority_class: 'REGULATORY',
    rule: 'Construction in a floodway requires DNR approval when upstream drainage area exceeds thresholds; FARA/eFARA may be required.',
    version: '2026.1',
    human_gate: true,
  },
  {
    id: 'IN-BAFM-REGULATORY',
    jurisdiction: 'Indiana',
    title: 'Best Available Floodplain Layer use for local permitting',
    citation: 'Indiana DNR Division of Water — INFIP / BAFM guidance',
    source_uri: 'https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/indiana-floodplain-information-portal',
    authority_class: 'REGULATORY',
    rule: 'INFIP combines FEMA and DNR floodplain information; BAFM may show more stream miles than NFHL. Do not collapse layers.',
    version: '2026.1',
    human_gate: true,
  },
  {
    id: 'FEMA-NFIP-BFE',
    jurisdiction: 'Federal',
    title: 'NFIP Base Flood Elevation / LOMA',
    citation: '44 CFR Part 60; FEMA LOMA guidance',
    source_uri: 'https://www.fema.gov/flood-maps',
    authority_class: 'REGULATORY',
    rule: 'BFE and LOMA determinations require FEMA process; system may prepare decision-support packages only.',
    version: '2026.1',
    human_gate: true,
  },
  {
    id: 'USACE-NO-RISE',
    jurisdiction: 'Federal',
    title: 'No-Rise certification tolerance',
    citation: 'USACE / FEMA No-Rise guidance; ΔWSE ≤ 0.00 ft as local policy target',
    source_uri: 'https://www.usace.army.mil/',
    authority_class: 'REGULATORY',
    rule: 'No automated No-Rise certification. Human engineer of record required.',
    version: '2026.1',
    human_gate: true,
  },
  {
    id: 'IN-GIS-STANDARDS',
    jurisdiction: 'Indiana',
    title: 'Indiana GIS Mapping Standards',
    citation: 'IC 4-23-7.3',
    source_uri: 'https://www.in.gov/gis/',
    authority_class: 'REGULATORY',
    rule: 'Framework data and data exchange agreements per IGIO; Data Harvest schemas for parcels/centerlines/addresses.',
    version: '2026.1',
    human_gate: false,
  },
  {
    id: 'TSM-HUMAN-AUTHORITY',
    jurisdiction: 'Tri-State Systems Manager',
    title: 'Human authority non-negotiable',
    citation: 'TSM Memorial Charter; ADR-004; ADR-005',
    source_uri: 'internal://tsm/charter',
    authority_class: 'REGULATORY',
    rule: 'Technology informs; it does not silently govern. No AI or automated output is a regulatory determination without human authorization.',
    version: '1.0.0',
    human_gate: true,
  },
];

/**
 * Evaluate which policies apply to a context. Returns citations — never auto-approvals.
 */
export function evaluatePolicies(context = {}) {
  const { state = 'Indiana', involvesFloodplain = false, involvesLOMA = false } = context;
  const applicable = POLICIES.filter((p) => {
    if (p.jurisdiction === 'Federal') return involvesFloodplain || involvesLOMA;
    if (p.jurisdiction === 'Tri-State Systems Manager') return true;
    if (state && p.jurisdiction === state) return true;
    return false;
  });
  return {
    evaluated_at: new Date().toISOString(),
    context,
    policies: applicable.map((p) => ({
      id: p.id,
      title: p.title,
      citation: p.citation,
      source_uri: p.source_uri,
      rule: p.rule,
      human_gate: p.human_gate,
      version: p.version,
    })),
    determination: null, // never auto-filled
    note: 'Policy engine returns citations and human_gate flags only. No silent regulatory determination.',
  };
}

export function getPolicy(id) {
  return POLICIES.find((p) => p.id === id) || null;
}
