/**
 * H3 coordinate system reference helpers for TSM.
 * Runtime encoding uses h3-js or h3-pg; this module is policy + formulas.
 */

export type H3Resolution = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export const H3_AVG_EDGE_LENGTH_KM: Readonly<Record<number, number>> = {
  0: 1107.712591, 1: 418.6760055, 2: 158.2446558, 3: 59.81085794,
  4: 22.6063794, 5: 8.544408276, 6: 3.229482772, 7: 1.220629759,
  8: 0.461354684, 9: 0.174375668, 10: 0.065907807, 11: 0.024910561,
  12: 0.009415526, 13: 0.003559893, 14: 0.001348575, 15: 0.000509713,
};

export const H3_AVG_AREA_KM2: Readonly<Record<number, number>> = {
  0: 4250546.847, 1: 607220.9782, 2: 86745.85403, 3: 12392.26486,
  4: 1770.323552, 5: 252.9033645, 6: 36.1290521, 7: 5.1612932,
  8: 0.7373276, 9: 0.1053325, 10: 0.0150475, 11: 0.0021496,
  12: 0.0003071, 13: 0.0000439, 14: 0.0000063, 15: 0.0000009,
};

/** |disk| = 3k(k+1)+1 */
export function h3DiskCellCount(k: number): number {
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a non-negative integer");
  return 3 * k * (k + 1) + 1;
}

/** ring(0)=1; ring(k)=6k for k>0 */
export function h3RingCellCount(k: number): number {
  if (!Number.isInteger(k) || k < 0) throw new Error("k must be a non-negative integer");
  return k === 0 ? 1 : 6 * k;
}

export const TSM_H3_POLICY = {
  regional: 5 as H3Resolution,
  community: 7 as H3Resolution,
  local: 9 as H3Resolution,
  site: 11 as H3Resolution,
  evidenceDefault: 9 as H3Resolution,
} as const;

export interface AxialCoord { q: number; r: number; }
export interface CubeCoord { i: number; j: number; k: number; }

export function axialToCube(a: AxialCoord): CubeCoord {
  const i = a.q;
  const k = a.r;
  return { i, j: -i - k, k };
}

export function cubeToAxial(c: CubeCoord): AxialCoord {
  return { q: c.i, r: c.k };
}

export function cubeDistance(a: CubeCoord, b: CubeCoord): number {
  return Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j), Math.abs(a.k - b.k));
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  return cubeDistance(axialToCube(a), axialToCube(b));
}

export type H3IndexString = string;
export const H3_COORDINATES_MODULE_VERSION = "1.0.0" as const;
