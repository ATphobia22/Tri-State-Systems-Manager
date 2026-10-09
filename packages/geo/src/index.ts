/**
 * Tri-State site spatial frame — horizontal EPSG:2966 (NAD83 / Indiana West ftUS),
 * vertical NAVD88. Anchors are owner-directed public site constants, not FEMA determinations.
 */

export const CRS_HORIZONTAL_EPSG = 2966 as const;
export const CRS_HORIZONTAL_NAME = 'NAD83 / Indiana West (ftUS)' as const;
export const VERTICAL_DATUM = 'NAVD88' as const;

export const BONEBANK_SITE = {
  label: '13101 Bonebank Road, Point Township, Posey County, IN',
  apn: '65-19-08-100-008.001-010',
  centroidLon: -88.0051,
  centroidLat: 37.84589,
  bfeFtNavd88: 375.0,
  lagFtNavd88: 377.2,
  freeboardFt: 2.2,
  ffeFtNavd88: 382.5,
  firmPanelPreferred: '18129C0300C',
} as const;

export const GAGE_SITES = {
  newHarmony: { siteNo: '03378500', gageZeroMetaFt: 352.71, conversionPublished: false },
  evansville: { siteNo: '03322000', gageZeroMetaFt: 328.38, conversionPublished: false },
} as const;
