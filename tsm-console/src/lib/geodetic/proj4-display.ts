/**
 * Display-path EPSG:2966 registration for proj4 (optional peer).
 * Analysis authority remains offline NGS / documented chains.
 * Does NOT load NADCON5 grids in-browser as regulatory truth.
 */

import { PROJ4_EPSG_2966, AUTHORITATIVE_HORIZONTAL_EPSG } from './constants';

export const PROJ4_DEF_EPSG_2966 = PROJ4_EPSG_2966;

type Proj4Adapter = {
  defs: (code: string, def?: string) => unknown;
} & ((from: string, to: string, coord: number[]) => number[]);

/** Register with a proj4 instance if available */
export function registerEpsg2966(proj4: {
  defs: (code: string, def?: string) => unknown;
}): void {
  proj4.defs(`EPSG:${AUTHORITATIVE_HORIZONTAL_EPSG}`, PROJ4_EPSG_2966);
}

/**
 * WGS84 lon/lat → Indiana West US ft (approximate without grid).
 * Mark results provisional for evidence packaging.
 */
export function wgs84ToEpsg2966Approx(
  proj4: Proj4Adapter,
  lon: number,
  lat: number
): { x_usft: number; y_usft: number; provisional: true } {
  registerEpsg2966(proj4 as unknown as { defs: (c: string, d?: string) => unknown });
  const [x, y] = proj4('WGS84', `EPSG:${AUTHORITATIVE_HORIZONTAL_EPSG}`, [lon, lat]);
  return { x_usft: x, y_usft: y, provisional: true };
}

export const DISPLAY_TRANSFORM_NOTE =
  'Client proj4 TM is for map UX only. Regulatory coordinates require documented NGS chain + human gate.';
