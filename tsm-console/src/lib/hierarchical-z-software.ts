/**
 * Software hierarchical-Z approximation — CPU mipmap of a depth buffer.
 *
 * True GPU Hierarchical-Z (compute mip chain + shader culling) is blocked:
 * MapLibre does not expose a WebGPU renderer. This module provides a CPU
 * pyramid for offline / test / non-realtime use and must not be claimed as
 * GPU H-Z.
 *
 * See docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md §1.
 */

export interface DepthPyramid {
  /** levels[0] = full resolution; each subsequent level is half size */
  levels: Float32Array[];
  width: number;
  height: number;
}

/**
 * Build a hierarchical max-depth pyramid (conservative occlusion: farther =
 * larger depth in GL convention). Input is row-major depth, length w*h.
 */
export function buildDepthPyramid(
  depth: Float32Array,
  width: number,
  height: number,
): DepthPyramid {
  if (width < 1 || height < 1) throw new RangeError('width/height must be >= 1');
  if (depth.length < width * height) throw new RangeError('depth buffer too small');

  const levels: Float32Array[] = [];
  let w = width;
  let h = height;
  let current = depth.slice(0, w * h);
  levels.push(current);

  while (w > 1 || h > 1) {
    const nw = Math.max(1, Math.ceil(w / 2));
    const nh = Math.max(1, Math.ceil(h / 2));
    const next = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let maxD = -Infinity;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = Math.min(w - 1, x * 2 + dx);
            const sy = Math.min(h - 1, y * 2 + dy);
            const d = current[sy * w + sx]!;
            if (d > maxD) maxD = d;
          }
        }
        next[y * nw + x] = maxD;
      }
    }
    levels.push(next);
    current = next;
    w = nw;
    h = nh;
  }

  return { levels, width, height };
}

/**
 * Conservative test: AABB is occluded if its nearest depth is behind the
 * pyramid max depth over the projected screen rect (in pixel coords).
 * Returns false (visible) when uncertain.
 */
export function isOccludedByPyramid(
  pyramid: DepthPyramid,
  screenMinX: number,
  screenMinY: number,
  screenMaxX: number,
  screenMaxY: number,
  nearestDepth: number,
): boolean {
  if (!Number.isFinite(nearestDepth)) return false;
  let level = 0;
  let w = pyramid.width;
  let h = pyramid.height;
  // Pick coarsest level that still covers the rect with >=1 texel
  while (level + 1 < pyramid.levels.length) {
    const nw = Math.max(1, Math.ceil(w / 2));
    const nh = Math.max(1, Math.ceil(h / 2));
    const scaleX = w / pyramid.width;
    const scaleY = h / pyramid.height;
    const rw = (screenMaxX - screenMinX) * scaleX;
    const rh = (screenMaxY - screenMinY) * scaleY;
    if (rw < 2 && rh < 2) break;
    level++;
    w = nw;
    h = nh;
  }
  const buf = pyramid.levels[level]!;
  const lw = level === 0 ? pyramid.width : Math.max(1, Math.ceil(pyramid.width / 2 ** level));
  const lh = level === 0 ? pyramid.height : Math.max(1, Math.ceil(pyramid.height / 2 ** level));
  const x0 = Math.max(0, Math.floor((screenMinX / pyramid.width) * lw));
  const y0 = Math.max(0, Math.floor((screenMinY / pyramid.height) * lh));
  const x1 = Math.min(lw - 1, Math.ceil((screenMaxX / pyramid.width) * lw));
  const y1 = Math.min(lh - 1, Math.ceil((screenMaxY / pyramid.height) * lh));
  let maxD = -Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = buf[y * lw + x]!;
      if (d > maxD) maxD = d;
    }
  }
  // Conservative: occluded only if nearest point is strictly farther than max Z in region
  return nearestDepth > maxD + 1e-5;
}

export const HIERARCHICAL_Z_STATUS = {
  implementation: 'software_cpu_pyramid',
  gpuHierarchicalZ: false,
  reason: 'MapLibre does not expose WebGPU compute for mipmapped depth culling',
} as const;
