/**
 * TSM Coordinate Transformer (ported from TSMCoordinateTransformer.swift)
 *
 * Indiana West State Plane (EPSG:2966, NAD83, US survey feet) <-> WGS84,
 * plus NAVD88 water-surface-elevation computation.
 *
 * CORRECTION vs the Swift original: the Swift file implemented an
 * equirectangular approximation while claiming Lambert Conformal Conic, used
 * Indiana EAST standard parallels, and a wrong false easting. Indiana West
 * (EPSG:2966) is Transverse Mercator. This module implements the standard
 * Snyder TM series with the repo's authoritative parameters
 * (see `geodetic/constants.ts` PROJ4_EPSG_2966):
 *   lat_0=37.5, lon_0=-87.0833333333333, k_0=0.999966667,
 *   false easting 900000 m, false northing 249999.9998984 m,
 *   GRS80 ellipsoid, output in US survey feet.
 *
 * Validated against pyproj (EPSG:4326 -> EPSG:2966) test vectors in the
 * companion test file. Standalone — no proj4 dependency required.
 */

const A = 6378137.0; // GRS80 semi-major axis (m)
const F = 1 / 298.257222101; // GRS80 flattening
const E2 = 2 * F - F * F;
const EP2 = E2 / (1 - E2);

const LAT0 = (37.5 * Math.PI) / 180;
const LON0 = ((-87.0833333333333 * Math.PI) / 180);
const K0 = 0.999966667;
const FE_M = 900000; // false easting, meters
const FN_M = 249999.9998984; // false northing, meters
const USFT_PER_M = 1 / 0.3048006096012192;

const M_COEF = 1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256;
const M_S2 = (3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024;
const M_S4 = (15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024;
const M_S6 = (35 * E2 * E2 * E2) / 3072;

function meridionalArc(phi: number): number {
  return (
    A *
    (M_COEF * phi -
      M_S2 * Math.sin(2 * phi) +
      M_S4 * Math.sin(4 * phi) -
      M_S6 * Math.sin(6 * phi))
  );
}

const M0 = meridionalArc(LAT0);

export interface IndianaWestFt {
  eastingUsFt: number;
  northingUsFt: number;
}

export interface Wgs84 {
  latitude: number;
  longitude: number;
}

/**
 * WGS84 -> Indiana West State Plane (EPSG:2966), US survey feet.
 */
export function wgs84ToIndianaWest(coord: Wgs84): IndianaWestFt {
  const phi = (coord.latitude * Math.PI) / 180;
  const lam = (coord.longitude * Math.PI) / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = EP2 * cosPhi * cosPhi;
  const A2 = (lam - LON0) * cosPhi;

  const x =
    K0 *
    N *
    (A2 +
      ((1 - T + C) * A2 * A2 * A2) / 6 +
      ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Math.pow(A2, 5)) / 120);
  const y =
    K0 *
    (meridionalArc(phi) -
      M0 +
      N *
        tanPhi *
        (A2 * A2 / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A2, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Math.pow(A2, 6)) / 720));

  return {
    eastingUsFt: (FE_M + x) * USFT_PER_M,
    northingUsFt: (FN_M + y) * USFT_PER_M,
  };
}

/**
 * Indiana West State Plane (EPSG:2966), US survey feet -> WGS84.
 */
export function indianaWestToWgs84(p: IndianaWestFt): Wgs84 {
  const x = p.eastingUsFt / USFT_PER_M - FE_M;
  const y = p.northingUsFt / USFT_PER_M - FN_M;

  const M = M0 + y / K0;
  const mu = M / (A * M_COEF);
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) * Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 * e1 * e1 * e1) / 512) * Math.sin(8 * mu);

  const sinPhi1 = Math.sin(phi1);
  const N1 = A / Math.sqrt(1 - E2 * sinPhi1 * sinPhi1);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = EP2 * Math.cos(phi1) ** 2;
  const R1 = (A * (1 - E2)) / Math.pow(1 - E2 * sinPhi1 * sinPhi1, 1.5);
  const D = x / (N1 * K0);

  const phi =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      (D * D / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * Math.pow(D, 4)) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) *
          Math.pow(D, 6)) /
          720);
  const lam =
    LON0 +
    (D -
      ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) *
        Math.pow(D, 5)) /
        120) /
      Math.cos(phi1);

  return {
    latitude: (phi * 180) / Math.PI,
    longitude: (lam * 180) / Math.PI,
  };
}

/**
 * Water Surface Elevation (NAVD88 ft) = gage height + gage zero (NAVD88 ft).
 * Pure arithmetic — carries no observation; callers must supply real,
 * provenance-stamped inputs.
 */
export function computeNavd88Wse(gageHeightFt: number, gageZeroNavd88Ft: number): number {
  return gageHeightFt + gageZeroNavd88Ft;
}
