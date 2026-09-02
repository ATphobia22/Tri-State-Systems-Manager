/**
 * PTDT v35 — Site Constants (aligned with FIRM SSOT)
 * EPSG:2966 = NAD83 / Indiana West (US survey feet)
 * Elevations are NAVD88 orthometric heights.
 * FIRM panel identity is sourced from the repository's NFHL REST verification record;
 * hardcopy FIRM/FIS remains controlling for regulatory determinations.
 */
export const BONEBANK_SITE = {
  name: "13101 Bonebank Road",
  county: "Posey",
  state: "IN",
  lat: 37.84589,
  lon: -88.0051,
  center: [-88.0051, 37.84589] as [number, number],
  zoom: 16.5,
  // Operational GIS query envelope around the anchor; not a regulatory boundary.
  bbox: [-88.0101, 37.84089, -88.0001, 37.85089] as [number, number, number, number],

  bfe_ft_navd88: 375.0,
  lag_ft_navd88: 377.2,
  ffe_ft_navd88: 382.5,
  berm_crest_ft_navd88: 379.8,

  parcel_apn_raw: "65-19-08-100-008.001-010",
  parcel_apn_normalized: "651908100008001010",
  assessor_authority: "Posey County Assessor (Nancy A. Hoehn)",

  cid_posey_unincorporated: "180209",
  cid_mount_vernon: "180389",
  cid_new_harmony: "180210",
  firm_panel_effective: "18129C0300C" as const,
  firm_panel_candidates: ["18129C0300C", "18129C0265C", "18129C0215C", "18129C0215D"] as const,
  firm_verification_status: "NFHL_REST_VERIFIED" as const,

  bca_bcr_ratio: 2.45,
} as const;

export type BonebankSite = typeof BONEBANK_SITE;
