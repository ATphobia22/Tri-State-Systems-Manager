/**
 * Meshlet frustum culling for Nanite plane B.
 * Sphere-vs-frustum using view-projection (column-major).
 */

import type { WebGpuCameraMatrices } from './maplibre-webgpu-camera';
import type { MeshletDescriptor, MeshletPack } from './meshlet-types';

export interface MeshletCullResult {
  visible: number[];
  culled: number;
  total: number;
}

/** Extract plane equations from column-major VP matrix (Gribb/Hartmann). */
function frustumPlanesFromVp(vp: Float32Array): Float32Array {
  // 6 planes × 4 coeffs
  const p = new Float32Array(24);
  // Left / Right / Bottom / Top / Near / Far
  const rows = [
    [vp[3]! + vp[0]!, vp[7]! + vp[4]!, vp[11]! + vp[8]!, vp[15]! + vp[12]!],
    [vp[3]! - vp[0]!, vp[7]! - vp[4]!, vp[11]! - vp[8]!, vp[15]! - vp[12]!],
    [vp[3]! + vp[1]!, vp[7]! + vp[5]!, vp[11]! + vp[9]!, vp[15]! + vp[13]!],
    [vp[3]! - vp[1]!, vp[7]! - vp[5]!, vp[11]! - vp[9]!, vp[15]! - vp[13]!],
    [vp[3]! + vp[2]!, vp[7]! + vp[6]!, vp[11]! + vp[10]!, vp[15]! + vp[14]!],
    [vp[3]! - vp[2]!, vp[7]! - vp[6]!, vp[11]! - vp[10]!, vp[15]! - vp[14]!],
  ];
  for (let i = 0; i < 6; i++) {
    const [a, b, c, d] = rows[i]!;
    const len = Math.hypot(a, b, c) || 1;
    p[i * 4] = a / len;
    p[i * 4 + 1] = b / len;
    p[i * 4 + 2] = c / len;
    p[i * 4 + 3] = d / len;
  }
  return p;
}

function multiplyMat4(a: Float32Array, b: Float32Array): Float32Array {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r]! * b[c * 4 + 0]! +
        a[1 * 4 + r]! * b[c * 4 + 1]! +
        a[2 * 4 + r]! * b[c * 4 + 2]! +
        a[3 * 4 + r]! * b[c * 4 + 3]!;
    }
  }
  return o;
}

function sphereVisible(
  planes: Float32Array,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): boolean {
  for (let i = 0; i < 6; i++) {
    const d =
      planes[i * 4]! * cx + planes[i * 4 + 1]! * cy + planes[i * 4 + 2]! * cz + planes[i * 4 + 3]!;
    if (d < -radius) return false;
  }
  return true;
}

export function cullMeshlets(
  pack: MeshletPack,
  camera: WebGpuCameraMatrices,
  /** Optional world transform of mesh origin in ENU */
  originENU: [number, number, number] = [0, 0, 0],
): MeshletCullResult {
  const vp = multiplyMat4(camera.projection, camera.view);
  const planes = frustumPlanesFromVp(vp);
  const visible: number[] = [];
  for (let i = 0; i < pack.meshlets.length; i++) {
    const m: MeshletDescriptor = pack.meshlets[i]!;
    const cx = m.bounds.center[0] + originENU[0];
    const cy = m.bounds.center[1] + originENU[1];
    const cz = m.bounds.center[2] + originENU[2];
    if (sphereVisible(planes, cx, cy, cz, m.bounds.radius)) {
      visible.push(i);
    }
  }
  return {
    visible,
    culled: pack.meshlets.length - visible.length,
    total: pack.meshlets.length,
  };
}
