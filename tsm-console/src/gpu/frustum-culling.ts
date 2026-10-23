/**
 * Presentation-plane frustum culling for WebGPU/MapLibre hosts.
 *
 * Pure math plan generator + optional visibility mask. Does not mutate
 * evidence, models, or regulatory state. MapLibre remains primary authority.
 */

export interface AabbMeters {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export interface CullableNode {
  readonly id: string;
  readonly aabb: AabbMeters;
}

/**
 * Column-major 4x4 view-projection matrix in metric local space.
 * Planes: left, right, bottom, top, near, far — each [a,b,c,d] with ax+by+cz+d >= 0 inside.
 */
export function extractFrustumPlanes(viewProj: Float32Array): Float32Array[] {
  if (viewProj.length !== 16) {
    throw new Error('viewProj must be 16 floats (column-major).');
  }
  const m = viewProj;
  const r0 = [m[0], m[4], m[8], m[12]];
  const r1 = [m[1], m[5], m[9], m[13]];
  const r2 = [m[2], m[6], m[10], m[14]];
  const r3 = [m[3], m[7], m[11], m[15]];

  const planes: number[][] = [
    [r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]],
    [r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]],
    [r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]],
    [r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]],
    [r3[0] + r2[0], r3[1] + r2[1], r3[2] + r2[2], r3[3] + r2[3]],
    [r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]],
  ];

  return planes.map((p) => {
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    return new Float32Array([p[0] / len, p[1] / len, p[2] / len, p[3] / len]);
  });
}

function aabbOutsidePlane(aabb: AabbMeters, plane: Float32Array): boolean {
  const x = plane[0] >= 0 ? aabb.max[0] : aabb.min[0];
  const y = plane[1] >= 0 ? aabb.max[1] : aabb.min[1];
  const z = plane[2] >= 0 ? aabb.max[2] : aabb.min[2];
  return plane[0] * x + plane[1] * y + plane[2] * z + plane[3] < 0;
}

export function isAabbVisible(aabb: AabbMeters, planes: Float32Array[]): boolean {
  for (const plane of planes) {
    if (aabbOutsidePlane(aabb, plane)) return false;
  }
  return true;
}

export interface CullPlan {
  readonly visibleIds: readonly string[];
  readonly culledIds: readonly string[];
  readonly planeCount: number;
  readonly authority: 'PRESENTATION_ONLY';
}

export function planFrustumCull(
  nodes: readonly CullableNode[],
  viewProj: Float32Array,
  maxNodes = 5000,
): CullPlan {
  if (nodes.length > maxNodes) {
    throw new Error(`Culling refused: ${nodes.length} nodes exceeds safety limit ${maxNodes}.`);
  }
  const planes = extractFrustumPlanes(viewProj);
  const visibleIds: string[] = [];
  const culledIds: string[] = [];
  for (const node of nodes) {
    if (isAabbVisible(node.aabb, planes)) visibleIds.push(node.id);
    else culledIds.push(node.id);
  }
  return {
    visibleIds,
    culledIds,
    planeCount: planes.length,
    authority: 'PRESENTATION_ONLY',
  };
}
