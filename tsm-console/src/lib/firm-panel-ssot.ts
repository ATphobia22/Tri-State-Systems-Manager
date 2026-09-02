/**
 * FIRM panel single source of truth — Posey County CID 180209
 *
 * NFHL REST identify (2026-09-02) at Bonebank lon/lat -88.0051, 37.84589:
 *   Layer 3 FIRM Panels → FIRM_PAN=18129C0300C, DFIRM_ID=18129C,
 *   EFF_DATE epoch ms 1415145600000 = 2014-11-05 (matches Posey ordinance).
 * Adjacent feature also returned IL panel 17059C0150D (Gallatin) — context only.
 *
 * Official NFIP product hierarchy: hardcopy FIRM + FIS control; NFHL is the
 * digital representation. TSM still does not issue LOMA determinations.
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
  regularProgramEntryNote:
    'Posey unincorporated FHBM 1977-06-24 → Regular Program / initial FIRM 1987-01-01; ordinance + NFHL EFF_DATE cite 2014-11-05.',
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
    panelId: '18129C0300C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'NFHL_REST_VERIFIED',
    role: 'canonical',
    notes:
      'NFHL MapServer layer 3 point-identify at structure coordinates (2026-09-02). EFF_DATE 2014-11-05.',
    mscSearchHint:
      'https://msc.fema.gov/portal/home — confirm FIRMette for 13101 Bonebank Rd / -88.0051,37.84589',
  },
  {
    panelId: '18129C0265C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Prior repository candidate — superseded as canonical by NFHL 0300C identify.',
    mscSearchHint: 'Adjacent panel check only',
  },
  {
    panelId: '18129C0215C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Legacy siteConstants candidate.',
    mscSearchHint: 'Legacy only',
  },
  {
    panelId: '18129C0215D',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Legacy backend candidate.',
    mscSearchHint: 'Legacy only',
  },
  {
    panelId: '17059C0150D',
    communityId: '17059C',
    communityName: 'Gallatin County IL (cross-river context)',
    countyFips: '17059',
    status: 'NFHL_REST_VERIFIED',
    role: 'context',
    notes: 'Returned by same NFHL point query — Illinois adjacent panel; not Posey regulatory panel.',
    mscSearchHint: 'Do not use for Indiana NFIP determinations',
  },
];

export const FIRM_SSOT = {
  structure: BONEBANK_LOOKUP,
  communityId: POSEY_NFIP.unincorporatedCid,
  effectiveMapDateOrdinance: POSEY_NFIP.effectiveMapDateOrdinance,
  effectivePanelId: '18129C0300C',
  verificationStatus: 'NFHL_REST_VERIFIED' as FirmVerificationStatus,
  verificationMethod:
    'FEMA public NFHL MapServer layer 3 (FIRM Panels) point query geometry=-88.0051,37.84589 inSR=4326',
  candidates: FIRM_PANEL_CANDIDATES,
  nfhlMapServer: 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer',
  mscPortal: 'https://msc.fema.gov/portal/home',
  policy:
    'NFHL digital identify supports TSM SSOT. Hardcopy FIRM+FIS remain official NFIP products. TSM does not determine SFHA or issue LOMA.',
};

export function firmPanelBannerText(): string {
  if (
    (FIRM_SSOT.verificationStatus === 'MSC_VERIFIED' ||
      FIRM_SSOT.verificationStatus === 'NFHL_REST_VERIFIED') &&
    FIRM_SSOT.effectivePanelId
  ) {
    return `FIRM panel ${FIRM_SSOT.effectivePanelId} (CID ${FIRM_SSOT.communityId}, map ${FIRM_SSOT.effectiveMapDateOrdinance}) — ${FIRM_SSOT.verificationStatus}. Still not a LOMA determination.`;
  }
  const ids = FIRM_SSOT.candidates.map((c) => c.panelId).join(' / ');
  return `FIRM panel PENDING MSC VERIFY for Bonebank (candidates ${ids}). Confirm on msc.fema.gov before regulatory use.`;
}
