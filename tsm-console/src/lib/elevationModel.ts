/**
 * Community engineering elevation utilities.
 * Values come from a legacy scenario contract and must be replaced by project evidence before engineering acceptance.
 */
import { SITE } from '../types/site';

export const FT_TO_M = 0.3048;
export const M_TO_FT = 1.0 / FT_TO_M;

export const SITE_ELEV_FT = {
  bfe: SITE.elevations.bfe_ft,
  lag: SITE.elevations.lag_ft,
  clearance: SITE.elevations.clearanceAboveBfe_ft,
  evidenceStatus: SITE.elevationEvidenceStatus,
} as const;

export const elevFtNavd88ToTwinZ_m = (elevFt: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  (elevFt - bfeFt) * FT_TO_M;

export const twinZ_mToElevFtNavd88 = (zM: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  bfeFt + zM * M_TO_FT;

export const lagTwinZ_m = (bfeFt = SITE_ELEV_FT.bfe, lagFt = SITE_ELEV_FT.lag): number =>
  elevFtNavd88ToTwinZ_m(lagFt, bfeFt);

export const bfeTwinZ_m = (): number => 0.0;

export type FloodBand = 'CLEAR' | 'WATCH' | 'WARNING' | 'CRITICAL';

export const classifyFloodBand = (waterSurfaceFt: number, bfeFt = SITE_ELEV_FT.bfe): FloodBand => {
  if (waterSurfaceFt >= bfeFt) return 'CRITICAL';
  if (waterSurfaceFt >= bfeFt - 2.0) return 'WARNING';
  if (waterSurfaceFt >= bfeFt - 5.0) return 'WATCH';
  return 'CLEAR';
};

export const clearanceFt = (
  waterSurfaceFt: number,
  reference: 'BFE' | 'LAG' = 'LAG',
  elevations = SITE_ELEV_FT,
): number => {
  const ref = reference === 'LAG' ? elevations.lag : elevations.bfe;
  return ref - waterSurfaceFt;
};

export const heightfieldTwinZ_m = (rawMeters: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  rawMeters - elevFtNavd88ToTwinZ_m(bfeFt);

export const lidarPointToTwinZ_m = (zFtNavd88: number, bfeFt = SITE_ELEV_FT.bfe): number =>
  elevFtNavd88ToTwinZ_m(zFtNavd88, bfeFt);
