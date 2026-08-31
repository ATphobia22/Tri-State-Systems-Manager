/**
 * PTDT v35 — Geographic anchors and case evidence constants.
 *
 * IMPORTANT: Point Township is the system's geographic anchor.
 * 13101 Bonebank Road is retained only as a case/evidence site for
 * FEMA Online LOMC Case 26-05-2022A; it is not the regional anchor.
 */
export const POINT_TOWNSHIP_ANCHOR = {
  name: "Point Township",
  county: "Posey",
  state: "IN",
  region: "Tri-State River Valley",
  boundaryAuthority: "Indiana Geographic Information Office",
  boundaryLayer:
    "https://gisdata.in.gov/server/rest/services/Hosted/Township_Boundaries_of_Indiana/FeatureServer/0",
  boundaryQuery: "mcd_name='Point' AND cnty_name='Posey'",
  boundarySpatialReference: "EPSG:4269",
  referenceCenter: [-87.9931, 37.8421] as [number, number],
  referenceCenterSource: "Mapcarta/GeoNames locality reference; visualization only",
  anchorScope: "civil-township boundary",
} as const;

/**
 * Case-specific evidence retained beneath the Point Township anchor.
 * These values are not generalized to the township.
 */
export const BONEBANK_SITE = {
  name: "13101 Bonebank Road",
  county: "Posey",
  state: "IN",
  township: "Point Township",
  lat: 37.8348,
  lon: -88.0142,
  center: [-88.0142, 37.8348] as [number, number],
  zoom: 16.5,
  bbox: [-88.035, 37.82, -88.005, 37.84] as [number, number, number, number],

  bfe_ft_navd88: 375.0,
  lag_ft_navd88: 377.2,
  ffe_ft_navd88: 382.5,
  berm_crest_ft_navd88: 379.8,

  parcel_apn_raw: "65-19-08-100-008.001-010",
  parcel_apn_normalized: "651908100008001010",
  assessor_authority: "Posey County Assessor",

  cid_posey_unincorporated: "180209",
  cid_mount_vernon: "180389",
  cid_new_harmony: "180210",
  firm_panel: "18129C0215D",

  loma_case_number: "26-05-2022A",
  bca_bcr_ratio: 2.45,
} as const;

export type PointTownshipAnchor = typeof POINT_TOWNSHIP_ANCHOR;
export type BonebankSite = typeof BONEBANK_SITE;
