/**
 * Point Township Digital Twin (PTDT) v35 - Site Constants & Geodetic Anchors
 * Target: 13101 Bonebank Road, Point Township, Posey County, Indiana
 * Horizontal: EPSG:2966 (NAD83 / Indiana West ftUS)
 * Vertical: NAVD88 (strict)
 */

export const BONEBANK_SITE = {
  name: "13101 Bonebank Road",
  county: "Posey",
  state: "IN",
  section: "35",
  township: "T7S",
  range: "R14W",
  lat: 37.8348,
  lon: -88.0142,
  center: [-88.0142, 37.8348] as [number, number],
  zoom: 16.5,
  bbox: [-88.035, 37.82, -88.005, 37.84] as [number, number, number, number],

  // Authoritative physical elevation baselines (ft NAVD88)
  bfe_ft_navd88: 375.0,
  lag_ft_navd88: 377.2,
  ffe_ft_navd88: 382.5,
  berm_crest_ft_navd88: 379.8,

  // Property registration
  parcel_apn_raw: "65-19-08-100-008.001-010",
  parcel_apn_normalized: "651908100008001010",
  assessor_authority: "Posey County Assessor (Nancy A. Hoehn)",

  // NFIP Community IDs (verified FEMA CIS 2026)
  cid_posey_unincorporated: "180209",
  cid_mount_vernon: "180389",
  cid_new_harmony: "180210",
  firm_panel: "18129C0215D",

  bca_bcr_ratio: 2.45,
} as const;

export type BonebankSite = typeof BONEBANK_SITE;
