export type PoseyEvidenceTier = 'tier1_regulatory' | 'tier2_government_derived' | 'tier3_technical' | 'tier4_project_calculation' | 'tier5_proposed' | 'tier6_legacy';

export interface PoseyEvidenceLedgerEntry {
  evidenceId: string;
  tier: PoseyEvidenceTier;
  sourceId: string;
  status: 'verified' | 'provisional' | 'unverified' | 'superseded';
  geographicScope: string;
  verticalDatum?: string;
  horizontalCrs?: string;
  regulatoryUse: 'regulatory' | 'engineering' | 'planning' | 'reference' | 'not_authoritative';
  humanReviewRequired: boolean;
  lastReviewed: string;
}

export const POSEY_EVIDENCE_LEDGER: readonly PoseyEvidenceLedgerEntry[] = [
  { evidenceId: 'DNR-INFIP', tier: 'tier1_regulatory', sourceId: 'DNR-INFIP', status: 'verified', geographicScope: 'Indiana / Posey County', regulatoryUse: 'regulatory', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'DNR-BAFL', tier: 'tier2_government_derived', sourceId: 'DNR-BAFL', status: 'verified', geographicScope: 'Indiana / Posey County', horizontalCrs: 'EPSG:26916', verticalDatum: 'NAVD88 for flood elevation points', regulatoryUse: 'planning', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'USGS-03378500', tier: 'tier3_technical', sourceId: 'USGS-03378500', status: 'provisional', geographicScope: 'Wabash River at New Harmony, Posey County', regulatoryUse: 'engineering', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'USGS-SIR-2016-5119', tier: 'tier3_technical', sourceId: 'USGS-SIR-2016-5119', status: 'verified', geographicScope: 'Wabash River at New Harmony', regulatoryUse: 'reference', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'FEMA-MSC', tier: 'tier1_regulatory', sourceId: 'FEMA-MSC', status: 'verified', geographicScope: 'FEMA effective mapping / project site', regulatoryUse: 'regulatory', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'LEGACY-375', tier: 'tier6_legacy', sourceId: 'LEGACY-375', status: 'unverified', geographicScope: 'Project artifact', verticalDatum: 'NAVD88 asserted by project artifact', regulatoryUse: 'not_authoritative', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'LEGACY-3687', tier: 'tier6_legacy', sourceId: 'LEGACY-3687', status: 'unverified', geographicScope: 'Project artifact', verticalDatum: 'NAVD88 asserted by project artifact', regulatoryUse: 'not_authoritative', humanReviewRequired: true, lastReviewed: '2026-08-25' },
];
