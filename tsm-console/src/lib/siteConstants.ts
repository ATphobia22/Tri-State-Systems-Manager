/**
 * TSM community-region constants.
 * This module intentionally contains no private residence or parcel identifier.
 * EPSG:2966 = NAD83 / Indiana West (US survey feet) where project data require that frame.
 * Elevations are scenario inputs only when independently evidenced; they are not universal design values.
 */
export const COMMUNITY_SITE = {
  name: 'Lower Wabash-Ohio Confluence Community',
  county: 'Posey',
  state: 'IN',
  lat: 38.13089124398878,
  lon: -87.94141452141561,
  center: [-87.94141452141561, 38.13089124398878] as [number, number],
  zoom: 10.5,
  bbox: [-88.35, 37.55, -87.55, 38.35] as [number, number, number, number],
  bfe_ft_navd88: null,
  lag_ft_navd88: null,
  ffe_ft_navd88: null,
  berm_crest_ft_navd88: null,
  cid_posey_unincorporated: '180209',
  cid_mount_vernon: '180389',
  cid_new_harmony: '180210',
  firm_verification_status: 'SOURCE_REQUIRED' as const,
} as const;

export type CommunitySite = typeof COMMUNITY_SITE;
