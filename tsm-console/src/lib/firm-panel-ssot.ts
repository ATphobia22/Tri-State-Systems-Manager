/**
 * FEMA NFHL/FIRM community-registry single source of truth.
 * No parcel, residence, or house-specific query geometry is stored here.
 * NFHL is a digital representation; hardcopy FIRM/FIS remain controlling for regulatory determinations.
 */

export type FirmVerificationStatus =
  | 'PENDING_MSC_VERIFY'
  | 'MSC_VERIFIED'
  | 'NFHL_REST_VERIFIED'
  | 'LOMC_SUPERSEDED';

export interface FirmPanelRecord {
  panelId: string;
  communityId: string;
  communityName: string;
  countyFips: string;
  status: FirmVerificationStatus;
  role: 'canonical' | 'alternate_candidate' | 'context';
  notes: string;
  mscSearchHint: string;
}

export const POSEY_NFIP = {
  countyFips: '18129',
  unincorporatedCid: '180209',
  mountVernonCid: '180389',
  newHarmonyCid: '180210',
  cynthianaCid: '180632',
  effectiveMapDateOrdinance: '2014-11-05',
  regularProgramEntryNote: 'Posey County community-level NFIP history; verify current effective products before regulatory use.',
} as const;

export const FIRM_PANEL_CANDIDATES: FirmPanelRecord[] = [
  {
    panelId: '18129C0300C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'NFHL_REST_VERIFIED',
    role: 'canonical',
    notes: 'Repository-level NFHL verification record retained at community scope; current site-specific regulatory use still requires official product review.',
    mscSearchHint: 'https://msc.fema.gov/portal/home — select the applicable community and current FIRM/FIS product.',
  },
  {
    panelId: '18129C0265C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Historical repository candidate; verify against current FEMA products.',
    mscSearchHint: 'Adjacent panel check only',
  },
  {
    panelId: '17059C0150D',
    communityId: '17059C',
    communityName: 'Gallatin County IL (cross-river context)',
    countyFips: '17059',
    status: 'NFHL_REST_VERIFIED',
    role: 'context',
    notes: 'Illinois adjacent panel retained only as regional context.',
    mscSearchHint: 'Do not use for Indiana NFIP determinations',
  },
];

export const FIRM_SSOT = {
  structure: {
    name: 'Lower Wabash-Ohio Confluence Community',
    communityId: POSEY_NFIP.unincorporatedCid,
  },
  communityId: POSEY_NFIP.unincorporatedCid,
  effectiveMapDateOrdinance: POSEY_NFIP.effectiveMapDateOrdinance,
  effectivePanelId: '18129C0300C',
  verificationStatus: 'NFHL_REST_VERIFIED' as FirmVerificationStatus,
  verificationMethod: 'FEMA public NFHL community/product verification; no private point query retained',
  candidates: FIRM_PANEL_CANDIDATES,
  nfhlMapServer: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
  mscPortal: 'https://msc.fema.gov/portal/home',
  policy: 'NFHL digital evidence supports TSM source tracking. Hardcopy FIRM+FIS remain official NFIP products. TSM does not determine SFHA or issue LOMA.',
};

export function firmPanelBannerText(): string {
  if ((FIRM_SSOT.verificationStatus === 'MSC_VERIFIED' || FIRM_SSOT.verificationStatus === 'NFHL_REST_VERIFIED') && FIRM_SSOT.effectivePanelId) {
    return `FIRM panel ${FIRM_SSOT.effectivePanelId} (CID ${FIRM_SSOT.communityId}, map ${FIRM_SSOT.effectiveMapDateOrdinance}) — ${FIRM_SSOT.verificationStatus}. Still not a LOMA determination.`;
  }
  const ids = FIRM_SSOT.candidates.map((c) => c.panelId).join(' / ');
  return `FIRM panel PENDING MSC VERIFY for community scope (candidates ${ids}). Confirm on msc.fema.gov before regulatory use.`;
}
