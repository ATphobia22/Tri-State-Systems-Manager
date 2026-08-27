/**
 * PTDT v35 — Sovereign Elevation & Math Utilities
 * Boundary: Twin Z is presentation-only; never mutates HEC-RAS / PostGIS.
 */
import { BONEBANK_SITE } from "./siteConstants";

export const FT_TO_M = 0.3048;
export const M_TO_FT = 1.0 / FT_TO_M;

export const SITE_ELEV_FT = {
  bfe: BONEBANK_SITE.bfe_ft_navd88,
  lag: BONEBANK_SITE.lag_ft_navd88,
  clearance: BONEBANK_SITE.lag_ft_navd88 - BONEBANK_SITE.bfe_ft_navd88,
} as const;

/** NAVD88 ft → Twin Z meters (BFE plane = origin). */
export const elevFtNavd88ToTwinZ_m = (elevFt: number): number =>
  (elevFt - SITE_ELEV_FT.bfe) * FT_TO_M;

export const twinZ_mToElevFtNavd88 = (zM: number): number =>
  SITE_ELEV_FT.bfe + zM * M_TO_FT;

export const lagTwinZ_m = (): number => elevFtNavd88ToTwinZ_m(SITE_ELEV_FT.lag);
export const bfeTwinZ_m = (): number => 0.0;

export type FloodBand = "CLEAR" | "WATCH" | "WARNING" | "CRITICAL";

export const classifyFloodBand = (waterSurfaceFt: number): FloodBand => {
  const bfe = SITE_ELEV_FT.bfe;
  if (waterSurfaceFt >= bfe) return "CRITICAL";
  if (waterSurfaceFt >= bfe - 2.0) return "WARNING";
  if (waterSurfaceFt >= bfe - 5.0) return "WATCH";
  return "CLEAR";
};

export const clearanceFt = (
  waterSurfaceFt: number,
  reference: "BFE" | "LAG" = "LAG"
): number => {
  const ref = reference === "LAG" ? SITE_ELEV_FT.lag : SITE_ELEV_FT.bfe;
  return ref - waterSurfaceFt;
};

export const heightfieldTwinZ_m = (rawMeters: number): number =>
  rawMeters - elevFtNavd88ToTwinZ_m(SITE_ELEV_FT.bfe);

export const lidarPointToTwinZ_m = (zFtNavd88: number): number =>
  elevFtNavd88ToTwinZ_m(zFtNavd88);
