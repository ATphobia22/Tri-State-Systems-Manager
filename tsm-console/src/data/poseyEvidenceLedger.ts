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
  { evidenceId: 'DNR-INFIP', tier: 'tier1_regulatory', sourceId: 'DNR-INFIP', status: 'verified', geographicScope: 'Indiana / Posey County', regulatoryUse: 'regulatory', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'DNR-BAFL', tier: 'tier2_government_derived', sourceId: 'DNR-BAFL', status: 'verified', geographicScope: 'Indiana / Posey County', horizontalCrs: 'EPSG:26916', verticalDatum: 'NAVD88 for flood elevation points', regulatoryUse: 'planning', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'INDIANA-PARCELS-2025', tier: 'tier2_government_derived', sourceId: 'INDIANA-PARCELS-2025', status: 'verified', geographicScope: 'Indiana / Posey County / Point Township', horizontalCrs: 'EPSG:4326', regulatoryUse: 'planning', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'INDIANA-CURRENT-IMAGERY', tier: 'tier2_government_derived', sourceId: 'INDIANA-CURRENT-IMAGERY', status: 'verified', geographicScope: 'Indiana / Posey County / Point Township', regulatoryUse: 'planning', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'USGS-3DEP-LIDAR', tier: 'tier3_technical', sourceId: 'USGS-3DEP-LIDAR', status: 'verified', geographicScope: 'Indiana / Posey County', regulatoryUse: 'engineering', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'USGS-INDIANA-2017-2020-LIDAR', tier: 'tier3_technical', sourceId: 'USGS-INDIANA-2017-2020-LIDAR', status: 'verified', geographicScope: 'Indiana / Posey County / western Indiana LiDAR phase', horizontalCrs: 'project metadata required', verticalDatum: 'project metadata required', regulatoryUse: 'reference', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'USGS-03378500', tier: 'tier3_technical', sourceId: 'USGS-03378500', status: 'provisional', geographicScope: 'Wabash River at New Harmony, Posey County', verticalDatum: 'NAVD88 station metadata; raw stage remains GAGE_DATUM', regulatoryUse: 'engineering', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'USGS-SIR-2016-5119', tier: 'tier3_technical', sourceId: 'USGS-SIR-2016-5119', status: 'verified', geographicScope: 'Wabash River at New Harmony', regulatoryUse: 'reference', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'NOAA-NWPS', tier: 'tier3_technical', sourceId: 'NOAA-NWPS', status: 'verified', geographicScope: 'Wabash/Ohio flood operations affecting Posey County', regulatoryUse: 'engineering', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'USACE-NLD', tier: 'tier2_government_derived', sourceId: 'USACE-NLD', status: 'verified', geographicScope: 'Posey County / Ohio-Wabash floodplain', regulatoryUse: 'planning', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'FEMA-MSC', tier: 'tier1_regulatory', sourceId: 'FEMA-MSC', status: 'verified', geographicScope: 'FEMA effective mapping / project site', regulatoryUse: 'regulatory', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'LEGACY-POINT-TWP-PLAT-FIRM-IMAGES', tier: 'tier6_legacy', sourceId: 'USER-PROVIDED-POINT-TWP-PLAT-FIRM-SCANS', status: 'verified', geographicScope: 'Point Township, Posey County, Indiana; T8S-R14W/R15W', regulatoryUse: 'not_authoritative', humanReviewRequired: true, lastReviewed: '2026-09-14' },
  { evidenceId: 'LEGACY-375', tier: 'tier6_legacy', sourceId: 'LEGACY-375', status: 'unverified', geographicScope: 'Project artifact', verticalDatum: 'NAVD88 asserted by project artifact', regulatoryUse: 'not_authoritative', humanReviewRequired: true, lastReviewed: '2026-08-25' },
  { evidenceId: 'LEGACY-3687', tier: 'tier6_legacy', sourceId: 'LEGACY-3687', status: 'unverified', geographicScope: 'Project artifact', verticalDatum: 'NAVD88 asserted by project artifact', regulatoryUse: 'not_authoritative', humanReviewRequired: true, lastReviewed: '2026-08-25' },
];
