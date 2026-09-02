/**
 * FIRM panel single source of truth — Posey County CID 180209
 *
 * Historical code drift used 18129C0215C, 18129C0215D, and 18129C0265C.
 * Canonical panel for the Bonebank parcel must be confirmed on FEMA MSC / NFHL
 * against the structure coordinates. Until human MSC confirmation is recorded,
 * status remains PENDING_MSC_VERIFY and all three candidates are listed.
 *
 * Official NFIP product hierarchy: hardcopy FIRM + FIS control; NFHL is the
 * digital representation (44 CFR 59–78 practice).
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
  regularProgramEntryNote:
    'Posey unincorporated FHBM 1977-06-24 → Regular Program / initial FIRM 1987-01-01 context retained in data/lomc/',
} as const;

/** Bonebank structure anchor used for MSC panel lookup */
export const BONEBANK_LOOKUP = {
  address: '13101 Bonebank Road, Point Township, Posey County, IN',
  apn: '65-19-08-100-008.001-010',
  lat: 37.84589,
  lon: -88.0051,
  bfeFtNavd88: 375.0,
  lagFtNavd88: 377.2,
} as const;

/**
 * Candidate panels observed in repository history.
 * Do not treat any as MSC-verified until status flips.
 */
export const FIRM_PANEL_CANDIDATES: FirmPanelRecord[] = [
  {
    panelId: '18129C0265C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'canonical_candidate',
    notes:
      'Primary candidate from prior FIRM workflow and map-layer registration. Confirm on MSC for Bonebank coordinates before PE/LOMA use.',
    mscSearchHint: 'https://msc.fema.gov/portal/home — search 13101 Bonebank Rd, Mount Vernon IN / Posey',
  },
  {
    panelId: '18129C0215C',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Appeared in tsm-console siteConstants; may be adjacent panel or legacy suffix.',
    mscSearchHint: 'Cross-check panel index on effective FIRM / NFHL S_FIRM_Pan layer',
  },
  {
    panelId: '18129C0215D',
    communityId: POSEY_NFIP.unincorporatedCid,
    communityName: 'Posey County Unincorporated Areas',
    countyFips: POSEY_NFIP.countyFips,
    status: 'PENDING_MSC_VERIFY',
    role: 'alternate_candidate',
    notes: 'Appeared in backend/gov/site_constants.py; suffix D may indicate revision — verify effective date.',
    mscSearchHint: 'Compare effective date and LOMC index before adopting',
  },
];

/** Runtime SSOT — update only after MSC human verification */
export const FIRM_SSOT = {
  structure: BONEBANK_LOOKUP,
  communityId: POSEY_NFIP.unincorporatedCid,
  /** Until MSC verify, expose candidates; UI must show PENDING banner */
  effectivePanelId: null as string | null,
  verificationStatus: 'PENDING_MSC_VERIFY' as FirmVerificationStatus,
  candidates: FIRM_PANEL_CANDIDATES,
  nfhlMapServer: 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer',
  policy:
    'Digital NFHL assists; official SFHA/BFE for NFIP remain effective FIRM+FIS. TSM does not determine SFHA.',
};

export function firmPanelBannerText(): string {
  if (FIRM_SSOT.verificationStatus === 'MSC_VERIFIED' && FIRM_SSOT.effectivePanelId) {
    return `FIRM panel ${FIRM_SSOT.effectivePanelId} (CID ${FIRM_SSOT.communityId}) — MSC verified in TSM SSOT. Still not a LOMA determination.`;
  }
  const ids = FIRM_SSOT.candidates.map((c) => c.panelId).join(' / ');
  return `FIRM panel PENDING MSC VERIFY for Bonebank (candidates ${ids}). Confirm on msc.fema.gov before regulatory use.`;
}
