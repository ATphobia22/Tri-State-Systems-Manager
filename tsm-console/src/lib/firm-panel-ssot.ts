/**
 * FIRM panel single source of truth — Posey County CID 180209
 *
 * Effective community FIRM date cited in Posey flood ordinance: November 5, 2014.
 * Exact panel for 13101 Bonebank (37.84589, -88.00510) still requires MSC interactive
 * pin / NFHL S_FIRM_Pan identify. Automated NFHL REST was not available from this
 * environment (2026-09-02). Status remains PENDING_MSC_VERIFY — do not claim MSC_VERIFIED
 * until a human records the panel ID from msc.fema.gov.
 */

export type FirmVerificationStatus =
  | 'PENDING_MSC_VERIFY'
  | 'MSC_VERIFIED'
  | 'LOMC_SUPERSEDED';

export interface FirmPanelRecord {
  panelId: string;
  communityId: string;
  communityName: string;
  countyFips: string;
  status: FirmVerificationStatus;
  role: 'canonical_candidate' | 'alternate_candidate' | 'context';
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
  regularProgramEntryNote:
    'Posey unincorporated FHBM 1977-06-24 → Regular Program / initial FIRM 1987-01-01 context; ordinance cites FIRM dated November 5, 2014.',
} as const;

export const BONEBANK_LOOKUP = {
  address: '13101 Bonebank Road, Point Township, Posey County, IN',
  apn: '65-19-08-100-008.001-010',
  lat: 37.84589,
  lon: -88.0051,
  bfeFtNavd88: 375.0,
  lagFtNavd88: 377.2,
} as const;

export const FIRM_PANEL_CANDIDATES: FirmPanelRecord[] = [
  {
    panelId: '18129C0265C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'canonical_candidate',
    notes:
      'Primary historical candidate. Confirm on MSC for Bonebank coordinates before PE/LOMA use.',
    mscSearchHint:
      'https://msc.fema.gov/portal/home — search 13101 Bonebank Rd OR lon,lat -88.0051,37.84589',
  },
  {
    panelId: '18129C0215C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Prior siteConstants candidate — may be adjacent panel.',
    mscSearchHint: 'Cross-check panel index on effective FIRM / NFHL S_FIRM_Pan',
  },
  {
    panelId: '18129C0215D',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Suffix D may indicate revision — verify effective date on MSC.',
    mscSearchHint: 'Compare effective date and LOMC index before adopting',
  },
];

export const FIRM_SSOT = {
  structure: BONEBANK_LOOKUP,
  communityId: POSEY_NFIP.unincorporatedCid,
  effectiveMapDateOrdinance: POSEY_NFIP.effectiveMapDateOrdinance,
  /** Null until MSC human verification records the panel */
  effectivePanelId: null as string | null,
  verificationStatus: 'PENDING_MSC_VERIFY' as FirmVerificationStatus,
  candidates: FIRM_PANEL_CANDIDATES,
  nfhlMapServer: 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer',
  mscPortal: 'https://msc.fema.gov/portal/home',
  policy:
    'Digital NFHL assists; official SFHA/BFE for NFIP remain effective FIRM+FIS. TSM does not determine SFHA. Do not set MSC_VERIFIED without human MSC pin.',
};

export function firmPanelBannerText(): string {
  if (FIRM_SSOT.verificationStatus === 'MSC_VERIFIED' && FIRM_SSOT.effectivePanelId) {
    return `FIRM panel ${FIRM_SSOT.effectivePanelId} (CID ${FIRM_SSOT.communityId}) — MSC verified in TSM SSOT. Still not a LOMA determination.`;
  }
  const ids = FIRM_SSOT.candidates.map((c) => c.panelId).join(' / ');
  return `FIRM panel PENDING MSC VERIFY for Bonebank (candidates ${ids}; ordinance map date ${FIRM_SSOT.effectiveMapDateOrdinance}). Confirm on msc.fema.gov before regulatory use.`;
}
