/**
 * Site WSE transfer and structural freeboard calculations.
 *
 * A single streamgage observation is NOT spatially interpolated to buildings.
 * IDW is permitted only when at least two validated, co-datum hydraulic control
 * points exist. Building LAG/FFE/BFE values must carry explicit verification.
 */
export type ElevationVerification = 'SURVEY_VERIFIED' | 'FEMA_FIS_VERIFIED' | 'FEMA_FIRM_VERIFIED' | 'UNVERIFIED';

export interface HydraulicControlPoint {
  id: string;
  lat: number;
  lon: number;
  wseNavd88Ft: number;
  verification: 'HYDRAULIC_PROFILE_VERIFIED';
}

export interface StructuralAssetElevation {
  assetId: string;
  name: string;
  lat: number;
  lon: number;
  lagNavd88Ft: number | null;
  ffeNavd88Ft: number | null;
  bfeNavd88Ft: number | null;
  lagVerification: ElevationVerification;
  ffeVerification: ElevationVerification;
  bfeVerification: ElevationVerification;
}

export interface StructuralClearance {
  assetId: string;
  name: string;
  siteWseNavd88Ft: number;
  lagClearanceFt: number | null;
  ffeClearanceFt: number | null;
  bfeClearanceFt: number | null;
  status: 'VERIFIED' | 'ELEVATION_DATA_REQUIRED';
}

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) throw new TypeError(field + ' must be finite');
}

function distanceSquared(latA: number, lonA: number, latB: number, lonB: number): number {
  const latScale = 69.0;
  const lonScale = 69.0 * Math.cos((latA * Math.PI) / 180);
  const dy = (latA - latB) * latScale;
  const dx = (lonA - lonB) * lonScale;
  return dx * dx + dy * dy;
}

export function interpolateSiteWseIdw(
  lat: number,
  lon: number,
  controlPoints: readonly HydraulicControlPoint[],
): number {
  assertFinite(lat, 'lat');
  assertFinite(lon, 'lon');
  if (controlPoints.length < 2) {
    throw new Error('At least two hydraulically validated co-datum control points are required for IDW site-WSE interpolation.');
  }
  const valid = controlPoints.filter(
    (point) =>
      point.verification === 'HYDRAULIC_PROFILE_VERIFIED' &&
      Number.isFinite(point.wseNavd88Ft) &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon),
  );
  if (valid.length < 2) throw new Error('Insufficient validated hydraulic control points for site-WSE interpolation.');

  let numerator = 0;
  let denominator = 0;
  for (const point of valid) {
    const d2 = distanceSquared(lat, lon, point.lat, point.lon);
    if (d2 === 0) return Number(point.wseNavd88Ft.toFixed(2));
    const weight = 1 / d2;
    numerator += point.wseNavd88Ft * weight;
    denominator += weight;
  }
  return Number((numerator / denominator).toFixed(2));
}

export function calculateStructuralClearance(
  asset: StructuralAssetElevation,
  siteWseNavd88Ft: number,
): StructuralClearance {
  assertFinite(siteWseNavd88Ft, 'siteWseNavd88Ft');
  const lagVerified = asset.lagNavd88Ft != null && asset.lagVerification === 'SURVEY_VERIFIED';
  const ffeVerified = asset.ffeNavd88Ft != null && asset.ffeVerification === 'SURVEY_VERIFIED';
  const bfeVerified = asset.bfeNavd88Ft != null &&
    (asset.bfeVerification === 'FEMA_FIS_VERIFIED' || asset.bfeVerification === 'FEMA_FIRM_VERIFIED');

  return {
    assetId: asset.assetId,
    name: asset.name,
    siteWseNavd88Ft,
    lagClearanceFt: lagVerified ? Number((asset.lagNavd88Ft! - siteWseNavd88Ft).toFixed(2)) : null,
    ffeClearanceFt: ffeVerified ? Number((asset.ffeNavd88Ft! - siteWseNav88Ft).toFixed(2)) : null,
    bfeClearanceFt: bfeVerified ? Number((asset.bfeNavd88Ft! - siteWseNavd88Ft).toFixed(2)) : null,
    status: lagVerified || ffeVerified || bfeVerified ? 'VERIFIED' : 'ELEVATION_DATA_REQUIRED',
  };
}
