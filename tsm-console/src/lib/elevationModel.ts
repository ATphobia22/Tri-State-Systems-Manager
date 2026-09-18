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

function requireElevation(value: number | null, label: string): number {
  if (value == null || !Number.isFinite(value)) throw new Error(`${label} requires verified project elevation evidence`);
  return value;
}

export const elevFtNavd88ToTwinZ_m = (elevFt: number, bfeFt?: number): number =>
  (elevFt - requireElevation(bfeFt ?? SITE_ELEV_FT.bfe, 'BFE')) * FT_TO_M;

export const twinZ_mToElevFtNavd88 = (zM: number, bfeFt?: number): number =>
  requireElevation(bfeFt ?? SITE_ELEV_FT.bfe, 'BFE') + zM * M_TO_FT;

export const lagTwinZ_m = (bfeFt?: number, lagFt?: number): number =>
  elevFtNavd88ToTwinZ_m(requireElevation(lagFt ?? SITE_ELEV_FT.lag, 'LAG'), bfeFt);

export const bfeTwinZ_m = (): number => 0.0;

export type FloodBand = 'CLEAR' | 'WATCH' | 'WARNING' | 'CRITICAL';

export const classifyFloodBand = (waterSurfaceFt: number, bfeFt?: number): FloodBand => {
  const reference = requireElevation(bfeFt ?? SITE_ELEV_FT.bfe, 'BFE');
  if (waterSurfaceFt >= reference) return 'CRITICAL';
  if (waterSurfaceFt >= reference - 2.0) return 'WARNING';
  if (waterSurfaceFt >= reference - 5.0) return 'WATCH';
  return 'CLEAR';
};

export const clearanceFt = (
  waterSurfaceFt: number,
  reference: 'BFE' | 'LAG' = 'LAG',
  elevations = SITE_ELEV_FT,
): number => {
  const ref = reference === 'LAG' ? elevations.lag : elevations.bfe;
  return requireElevation(ref, reference) - waterSurfaceFt;
};

export const heightfieldTwinZ_m = (rawMeters: number, bfeFt?: number): number =>
  rawMeters - elevFtNavd88ToTwinZ_m(requireElevation(bfeFt ?? SITE_ELEV_FT.bfe, 'BFE'));

export const lidarPointToTwinZ_m = (zFtNavd88: number, bfeFt?: number): number =>
  elevFtNavd88ToTwinZ_m(zFtNavd88, bfeFt);
