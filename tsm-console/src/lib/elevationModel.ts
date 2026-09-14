/**
 * Community engineering elevation utilities.
 * Scenario elevations are never silently inherited from a private property.
 */
import { COMMUNITY_SITE } from './siteConstants';

export const FT_TO_M = 0.3048;
export const M_TO_FT = 1.0 / FT_TO_M;

export const SITE_ELEV_FT = {
  bfe: COMMUNITY_SITE.bfe_ft_navd88,
  lag: COMMUNITY_SITE.lag_ft_navd88,
  clearance: null,
} as const;

const requireEvidenceElevation = (value: number | null, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} requires an evidence-backed project elevation`);
  }
  return value;
};

export const elevFtNavd88ToTwinZ_m = (elevFt: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  (elevFt - requireEvidenceElevation(bfeFt, 'BFE')) * FT_TO_M;

export const twinZ_mToElevFtNavd88 = (zM: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  requireEvidenceElevation(bfeFt, 'BFE') + zM * M_TO_FT;

export const lagTwinZ_m = (bfeFt = SITE_ELEV_FT.bfe, lagFt = SITE_ELEV_FT.lag): number =>
  elevFtNavd88ToTwinZ_m(requireEvidenceElevation(lagFt, 'LAG'), bfeFt);

export const bfeTwinZ_m = (): number => 0.0;

export type FloodBand = 'CLEAR' | 'WATCH' | 'WARNING' | 'CRITICAL';

export const classifyFloodBand = (waterSurfaceFt: number, bfeFt = SITE_ELEV_FT.bfe): FloodBand => {
  const bfe = requireEvidenceElevation(bfeFt, 'BFE');
  if (waterSurfaceFt >= bfe) return 'CRITICAL';
  if (waterSurfaceFt >= bfe - 2.0) return 'WARNING';
  if (waterSurfaceFt >= bfe - 5.0) return 'WATCH';
  return 'CLEAR';
};

export const clearanceFt = (
  waterSurfaceFt: number,
  reference: 'BFE' | 'LAG' = 'LAG',
  elevations = SITE_ELEV_FT,
): number => {
  const ref = reference === 'LAG'
    ? requireEvidenceElevation(elevations.lag, 'LAG')
    : requireEvidenceElevation(elevations.bfe, 'BFE');
  return ref - waterSurfaceFt;
};

export const heightfieldTwinZ_m = (rawMeters: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  rawMeters - elevFtNavd88ToTwinZ_m(requireEvidenceElevation(bfeFt, 'BFE'));

export const lidarPointToTwinZ_m = (zFtNavd88: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  elevFtNavd88ToTwinZ_m(zFtNavd88, bfeFt);
