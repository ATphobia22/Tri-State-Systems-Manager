/**
 * Software hierarchical-Z approximation — CPU mipmap of a depth buffer.
 *
 * True GPU Hierarchical-Z (compute mip chain + shader culling) is not
 * implemented here. This module provides a CPU pyramid for offline/test use
 * and must not be represented as GPU H-Z.
 *
 * Depth convention: standard depth in [0, 1], with farther values larger.
 * Invalid or out-of-viewport queries conservatively return visible.
 *
 * See docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md §1.
 */

export interface DepthPyramid {
  /** levels[0] = full resolution; each subsequent level is half size */
  levels: Float32Array[];
  width: number;
  height: number;
}

/** Build a conservative max-depth pyramid for a standard [0, 1] depth buffer. */
export function buildDepthPyramid(
  depth: Float32Array,
  width: number,
  height: number,
): DepthPyramid {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new RangeError('width and height must be positive safe integers');
  }
  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount) || depth.length < pixelCount) {
    throw new RangeError('depth buffer is too small for the requested dimensions');
  }
  for (let i = 0; i < pixelCount; i++) {
    const value = depth[i]!;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`depth[${i}] must be finite and in [0, 1]`);
    }
  }

  const levels: Float32Array[] = [];
  let w = width;
  let h = height;
  let current = depth.slice(0, pixelCount);
  levels.push(current);

  while (w > 1 || h > 1) {
    const nw = Math.max(1, Math.ceil(w / 2));
    const nh = Math.max(1, Math.ceil(h / 2));
    const next = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        let maxDepth = -Infinity;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = x * 2 + dx;
            const sy = y * 2 + dy;
            if (sx >= w || sy >= h) continue;
            const value = current[sy * w + sx]!;
            if (value > maxDepth) maxDepth = value;
          }
        }
        next[y * nw + x] = maxDepth;
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
 * Conservative test for standard depth: an AABB is occluded only if its
 * nearest depth is behind every depth sample covered by the selected pyramid
 * region. Any invalid or entirely off-screen rectangle returns visible.
 */
export function isOccludedByPyramid(
  pyramid: DepthPyramid,
  screenMinX: number,
  screenMinY: number,
  screenMaxX: number,
  screenMaxY: number,
  nearestDepth: number,
): boolean {
  if (
    !Number.isFinite(nearestDepth) ||
    nearestDepth < 0 ||
    nearestDepth > 1 ||
    !Number.isSafeInteger(pyramid.width) ||
    !Number.isSafeInteger(pyramid.height) ||
    pyramid.width < 1 ||
    pyramid.height < 1 ||
    pyramid.levels.length === 0 ||
    ![screenMinX, screenMinY, screenMaxX, screenMaxY].every(Number.isFinite) ||
    screenMinX > screenMaxX ||
    screenMinY > screenMaxY
  ) {
    return false;
  }

  // A fully off-screen bound cannot be proven occluded by this viewport.
  if (
    screenMaxX < 0 ||
    screenMaxY < 0 ||
    screenMinX >= pyramid.width ||
    screenMinY >= pyramid.height
  ) {
    return false;
  }

  const minX = Math.max(0, Math.min(pyramid.width - 1, screenMinX));
  const minY = Math.max(0, Math.min(pyramid.height - 1, screenMinY));
  const maxX = Math.max(0, Math.min(pyramid.width - 1, screenMaxX));
  const maxY = Math.max(0, Math.min(pyramid.height - 1, screenMaxY));

  let level = 0;
  let w = pyramid.width;
  let h = pyramid.height;
  while (level + 1 < pyramid.levels.length) {
    const rw = (maxX - minX + 1) / 2 ** level;
    const rh = (maxY - minY + 1) / 2 ** level;
    if (rw < 2 && rh < 2) break;
    level++;
    w = Math.max(1, Math.ceil(w / 2));
    h = Math.max(1, Math.ceil(h / 2));
  }

  const buf = pyramid.levels[level];
  if (!buf || buf.length < w * h) return false;

  const x0 = Math.max(0, Math.floor(minX / 2 ** level));
  const y0 = Math.max(0, Math.floor(minY / 2 ** level));
  const x1 = Math.min(w - 1, Math.floor(maxX / 2 ** level));
  const y1 = Math.min(h - 1, Math.floor(maxY / 2 ** level));
  if (x0 > x1 || y0 > y1) return false;

  let maxDepth = -Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const value = buf[y * w + x];
      if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) {
        return false;
      }
      if (value > maxDepth) maxDepth = value;
    }
  }

  // Bias toward visible to avoid false occlusion from precision differences.
  return Number.isFinite(maxDepth) && nearestDepth > maxDepth + 1e-5;
}

export const HIERARCHICAL_Z_STATUS = {
  implementation: 'software_cpu_pyramid',
  gpuHierarchicalZ: false,
  reason: 'GPU H-Z requires a GPU depth pyramid and renderer integration; this is CPU-only.',
} as const;
