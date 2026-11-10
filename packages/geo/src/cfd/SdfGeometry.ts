/**
 * Minimal signed-distance field helpers for geometry / level-set style work.
 * MODEL_SIMULATION — not survey geometry.
 */

export const SDF_AUTHORITY = "MODEL_SIMULATION" as const;

export type Vec3 = { x: number; y: number; z: number };

export function sdfSphere(p: Vec3, center: Vec3, radius: number): number {
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const dz = p.z - center.z;
  return Math.hypot(dx, dy, dz) - radius;
}

export function sdfPlane(p: Vec3, normal: Vec3, d: number): number {
  const len = Math.hypot(normal.x, normal.y, normal.z) || 1;
  return (normal.x * p.x + normal.y * p.y + normal.z * p.z) / len - d;
}

/** Approximate free-surface plane at z = waterSurfaceZ (local ENU-style). */
export function sdfWaterSurface(p: Vec3, waterSurfaceZ: number): number {
  return p.z - waterSurfaceZ;
}

export function sdfUnion(a: number, b: number): number {
  return Math.min(a, b);
}

export function sdfIntersection(a: number, b: number): number {
  return Math.max(a, b);
}

export function sdfDifference(a: number, b: number): number {
  return Math.max(a, -b);
}
