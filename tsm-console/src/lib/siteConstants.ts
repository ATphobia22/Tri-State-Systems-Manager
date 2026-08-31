/**
 * PTDT v35 — Site Constants (aligned with tsm-site-constants JSON)
 * EPSG:2966 = NAD83 / Indiana West (US survey feet)
 * FFE locked at 382.5 ft NAVD88
 */
export const BONEBANK_SITE = {
  name: "13101 Bonebank Road",
  county: "Posey",
  state: "IN",
  lat: 37.84589,
  lon: -88.0051,
  center: [-88.0051, 37.84589] as [number, number],
  zoom: 16.5,
  bbox: [-88.035, 37.82, -88.005, 37.84] as [number, number, number, number],

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
  firm_panel: "18129C0215C",

  bca_bcr_ratio: 2.45,
} as const;

export type BonebankSite = typeof BONEBANK_SITE;
