/**
 * CRS validation and geodetic transforms for TSM.
 * Authoritative engineering CRS: EPSG:2966 (NAD83 / Indiana West ftUS).
 * Display / MapLibre: EPSG:4326.
 * LiDAR HARN variant often EPSG:2968 — accepted as sibling Indiana West.
 * Vertical: NAVD88 orthometric; never pass NAVD88 as ellipsoidal height to ECEF.
 */

export type CrsCode =
  | 'EPSG:4326'
  | 'EPSG:4269'
  | 'EPSG:2966'
  | 'EPSG:2968'
  | 'EPSG:4978'
  | 'EPSG:4979'
  | 'EPSG:3857';

export type VerticalDatum = 'NAVD88' | 'ELLIPSOIDAL_WGS84' | 'UNKNOWN';

export interface CrsDescriptor {
  code: CrsCode;
  name: string;
  axis: 'ENU_geographic' | 'projected_ftUS' | 'ecef_m' | 'web_mercator_m';
  units: 'degree' | 'us_survey_foot' | 'metre';
  horizontalOnly: boolean;
}

export const CRS_REGISTRY: Record<CrsCode, CrsDescriptor> = {
  'EPSG:4326': { code: 'EPSG:4326', name: 'WGS 84', axis: 'ENU_geographic', units: 'degree', horizontalOnly: true },
  'EPSG:4269': { code: 'EPSG:4269', name: 'NAD83', axis: 'ENU_geographic', units: 'degree', horizontalOnly: true },
  'EPSG:2966': { code: 'EPSG:2966', name: 'NAD83 / Indiana West (ftUS)', axis: 'projected_ftUS', units: 'us_survey_foot', horizontalOnly: true },
  'EPSG:2968': { code: 'EPSG:2968', name: 'NAD83(HARN) / Indiana West (ftUS)', axis: 'projected_ftUS', units: 'us_survey_foot', horizontalOnly: true },
  'EPSG:4978': { code: 'EPSG:4978', name: 'WGS 84 geocentric (ECEF)', axis: 'ecef_m', units: 'metre', horizontalOnly: false },
  'EPSG:4979': { code: 'EPSG:4979', name: 'WGS 84 geographic 3D', axis: 'ENU_geographic', units: 'degree', horizontalOnly: false },
  'EPSG:3857': { code: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', axis: 'web_mercator_m', units: 'metre', horizontalOnly: true },
};

export const BONEBANK_WGS84 = { lon: -88.0142, lat: 37.8348 } as const;

export class CrsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrsValidationError';
  }
}

const US_SURVEY_FT_TO_M = 1200 / 3937;

const IN_WEST = {
  lat0: (37.5 * Math.PI) / 180,
  lon0: (-87.08333333333333 * Math.PI) / 180,
  k0: 0.999966667,
  falseEastingFt: 2952750,
  falseNorthingFt: 820208.333,
  a: 6378137.0,
  f: 1 / 298.257222101,
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function parseCrsCode(raw: string | null | undefined): CrsCode {
  if (!raw || typeof raw !== 'string') throw new CrsValidationError('CRS code is required');
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  const withPrefix = normalized.startsWith('EPSG:') ? normalized : `EPSG:${normalized}`;
  if (!(withPrefix in CRS_REGISTRY)) throw new CrsValidationError(`Unsupported CRS: ${raw}`);
  return withPrefix as CrsCode;
}

export function assertCrsCompatible(source: CrsCode, target: CrsCode, vertical?: VerticalDatum): void {
  parseCrsCode(source);
  parseCrsCode(target);
  if (target === 'EPSG:4978' && vertical === 'NAVD88') {
    throw new CrsValidationError(
      'Refusing ECEF conversion with NAVD88 heights; convert orthometric→ellipsoidal via GEOID18 first',
    );
  }
  if (source === target) return;
  const allowed = new Set([
    'EPSG:4326->EPSG:3857',
    'EPSG:4269->EPSG:4326',
    'EPSG:2966->EPSG:4326',
    'EPSG:2968->EPSG:4326',
    'EPSG:4326->EPSG:2966',
    'EPSG:4326->EPSG:2968',
    'EPSG:2966->EPSG:2968',
    'EPSG:2968->EPSG:2966',
    'EPSG:4326->EPSG:4978',
    'EPSG:4979->EPSG:4978',
  ]);
  const key = `${source}->${target}`;
  if (!allowed.has(key)) throw new CrsValidationError(`Transform ${key} is not in the approved TSM CRS graph`);
}

export function validateLonLat(lon: number, lat: number): void {
  if (!isFiniteNumber(lon) || !isFiniteNumber(lat)) throw new CrsValidationError('lon/lat must be finite numbers');
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new CrsValidationError(`lon/lat out of range: (${lon}, ${lat})`);
  }
}

export const POSEY_BBOX_WGS84 = { west: -88.12, south: 37.756, east: -87.681, north: 38.239 } as const;

export function assertInsidePoseyAoi(lon: number, lat: number, strict = false): void {
  validateLonLat(lon, lat);
  const { west, south, east, north } = POSEY_BBOX_WGS84;
  const inside = lon >= west && lon <= east && lat >= south && lat <= north;
  if (!inside && strict) throw new CrsValidationError(`Coordinate (${lon}, ${lat}) outside Posey AOI`);
}

export function geodeticToEcef(lonDeg: number, latDeg: number, heightEllipsoidalM: number): [number, number, number] {
  validateLonLat(lonDeg, latDeg);
  if (!isFiniteNumber(heightEllipsoidalM)) throw new CrsValidationError('Ellipsoidal height must be finite');
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const x = (N + heightEllipsoidalM) * cosLat * Math.cos(lon);
  const y = (N + heightEllipsoidalM) * cosLat * Math.sin(lon);
  const z = (N * (1 - e2) + heightEllipsoidalM) * sinLat;
  return [x, y, z];
}

export function wgs84ToIndianaWestFt(lonDeg: number, latDeg: number): { eastingFt: number; northingFt: number } {
  validateLonLat(lonDeg, latDeg);
  const { a, f, lat0, lon0, k0, falseEastingFt, falseNorthingFt } = IN_WEST;
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = ep2 * Math.cos(lat) ** 2;
  const A = (lon - lon0) * Math.cos(lat);
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));
  const M0 =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat0 -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat0) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat0) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat0));
  const eastingM =
    k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) +
    falseEastingFt * US_SURVEY_FT_TO_M;
  const northingM =
    k0 *
      (M - M0 +
        N * Math.tan(lat) *
          (A ** 2 / 2 +
            ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
            ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720)) +
    falseNorthingFt * US_SURVEY_FT_TO_M;
  return { eastingFt: eastingM / US_SURVEY_FT_TO_M, northingFt: northingM / US_SURVEY_FT_TO_M };
}

export function validateFeatureCollectionCrs(crsProperty: unknown, expected: CrsCode = 'EPSG:4326'): CrsCode {
  if (crsProperty == null) return expected;
  if (typeof crsProperty === 'string') return parseCrsCode(crsProperty);
  if (typeof crsProperty === 'object' && crsProperty !== null && 'properties' in crsProperty) {
    const name = (crsProperty as { properties?: { name?: string } }).properties?.name;
    if (name) return parseCrsCode(name);
  }
  throw new CrsValidationError('Unable to parse FeatureCollection CRS');
}

export function requireHorizontalCrsForWebDisplay(code: CrsCode): void {
  if (code !== 'EPSG:4326' && code !== 'EPSG:3857' && code !== 'EPSG:4269') {
    throw new CrsValidationError(
      `Web display requires geographic or Web Mercator CRS; got ${code}. Transform via approved graph first.`,
    );
  }
}
