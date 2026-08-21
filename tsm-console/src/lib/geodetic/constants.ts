/** Geodetic constants — analysis frame EPSG:2966 + NAVD88 */

export const AUTHORITATIVE_HORIZONTAL_EPSG = 2966 as const;
export const REJECTED_HORIZONTAL_EPSG = [2967] as const;
export const AUTHORITATIVE_VERTICAL = 'NAVD88' as const;
export const PARAM_SET_ID = 'NGS-HTDP-ITRF2014-v2' as const;

export const PROJ4_EPSG_2966 =
  '+proj=tmerc +lat_0=37.5 +lon_0=-87.0833333333333 +k=0.999966667 +x_0=900000 +y_0=249999.9998984 +ellps=GRS80 +units=us-ft +no_defs';

export const EXPECTED_FORWARD_OPS = [
  'inverse_transverse_mercator',
  'geodetic_to_ecef',
  'helmert_14_param',
  'htdp_propagate',
  'ecef_to_geodetic',
] as const;

/**
 * Velocity / deformation models
 * EPP = rigid plate rotation (frame change, not epoch)
 * IFDM = residual motion inside the plate (epoch change; horizontal + vertical)
 */
export const VELOCITY_MODELS = {
  htdp_interseismic: 'HTDP-velocity-field',
  htdp_coseismic: 'HTDP-Okada-initeq',
  epp2022: 'EPP2022',
  ifdm2022: 'IFDM2022',
  /** formerly IFVM2022 */
  ifdm_alias: 'IFVM2022',
  posey_coseismic_relevant: false,
  stable_interior_mm_per_yr_order: 15,
  /** NATRF2022 beta EPP (mas/yr) — reference; use NGS beta tables in production */
  natrf2022_epp_mas_per_yr: { omega_x: 0.046, omega_y: -0.704, omega_z: -0.047 },
  natrf_epoch: 2020.0,
} as const;

/**
 * Vertical / gravimetric models
 * GEOID18 = last hybrid; GRAV-D → xGEOID → GEOID2022 / NAPGD2022
 */
export const VERTICAL_MODELS = {
  authoritative: 'NAVD88',
  ellipsoid_to_orthometric: 'GEOID18',
  ngvd29_to_navd88: 'VERTCON3',
  future_geoid: 'GEOID2022',
  future_datum: 'NAPGD2022',
  grav_d: 'GRAV-D',
  grav_d_follow_on: 'GRAV-D-FO',
  xgeoid_series: 'xGEOID',
  gems: 'GeMS',
  geoid18_conus_sigma_cm: 1.27,
  geoid18_gpsbm_count: 32357,
  reject_new_without_chain: ['NAVD29', 'NGVD29'] as const,
} as const;

export const GEODETIC_POLICY = {
  analysis_frame: 'EPSG:2966 + NAVD88',
  display_frame: 'WGS84 / Web Mercator (MapLibre)',
  htdp_coseismic_relevant_to_posey: false,
  reject_epsg: REJECTED_HORIZONTAL_EPSG,
  velocity_models: VELOCITY_MODELS,
  vertical_models: VERTICAL_MODELS,
  modernization_status: 'WATCH' as const,
} as const;
