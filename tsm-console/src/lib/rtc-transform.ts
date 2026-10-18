/**
 * TSM RTC (Relative To Center) Transform Utilities
 *
 * Implements 3D Tiles 1.0 RTC rendering per the specification:
 * https://github.com/CesiumGS/3d-tiles/blob/main/specification/TileFormats/Batched3DModel/README.md
 *
 * Problem: 32-bit float precision causes jitter when rendering objects far
 * from the coordinate system origin (e.g., ECEF coordinates ~6,000,000m).
 *
 * Solution: Store vertex positions relative to RTC_CENTER (small values),
 * then modify the Model-View matrix at render time:
 *   1. Transform RTC_CENTER to eye coordinates: RTC_CENTER_eye = MV * RTC_CENTER
 *   2. Replace the translation column of MV with RTC_CENTER_eye
 *   3. Render with the modified single-precision matrix
 *
 * For 3D Tiles 1.1: RTC_CENTER is deprecated; use glTF node transforms instead.
 * This module handles 1.0 tilesets that still use RTC_CENTER.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

/**
 * Transform a point by a 4x4 matrix (column-major, as used by WebGL).
 */
export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
  return {
    x: (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12]) / w,
    y: (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13]) / w,
    z: (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]) / w,
  };
}

/**
 * Create an RTC-adjusted Model-View matrix.
 *
 * @param modelView - Original 4x4 model-view matrix (double precision on CPU)
 * @param rtcCenter - RTC_CENTER from the tile's feature table
 * @returns Modified 4x4 matrix with RTC_CENTER baked into the translation column
 *
 * Per spec: "The RTC_CENTER is transformed into eye coordinates using the
 * original Model-View matrix: RTC_CENTER_eye = MV * RTC_CENTER. The
 * Model-View matrix used for rendering is then created by replacing the
 * last column of the original with RTC_CENTER_eye."
 */
export function createRTCModelView(modelView: Mat4, rtcCenter: Vec3): Mat4 {
  // Transform RTC_CENTER to eye coordinates (using double precision)
  const rtcEye = transformPoint(modelView, rtcCenter);

  // Create modified matrix: copy original, replace translation column
  const result: Mat4 = [...modelView] as Mat4;
  result[12] = rtcEye.x;
  result[13] = rtcEye.y;
  result[14] = rtcEye.z;
  // result[15] stays as-is (should be 1.0)

  return result;
}

/**
 * Convert RTC-relative vertex positions to absolute positions.
 * Useful for CPU-side operations (bounding volumes, picking).
 *
 * @param relative - Vertex positions relative to RTC_CENTER
 * @param rtcCenter - The RTC_CENTER value
 * @returns Absolute vertex positions
 */
export function rtcToAbsolute(relative: Float32Array, rtcCenter: Vec3): Float32Array {
  const result = new Float32Array(relative.length);
  for (let i = 0; i < relative.length; i += 3) {
    result[i] = relative[i] + rtcCenter.x;
    result[i + 1] = relative[i + 1] + rtcCenter.y;
    result[i + 2] = relative[i + 2] + rtcCenter.z;
  }
  return result;
}

/**
 * Convert absolute vertex positions to RTC-relative.
 * Useful when generating tiles with RTC_CENTER.
 */
export function absoluteToRTC(absolute: Float32Array, rtcCenter: Vec3): Float32Array {
  const result = new Float32Array(absolute.length);
  for (let i = 0; i < absolute.length; i += 3) {
    result[i] = absolute[i] - rtcCenter.x;
    result[i + 1] = absolute[i + 1] - rtcCenter.y;
    result[i + 2] = absolute[i + 2] - rtcCenter.z;
  }
  return result;
}

/**
 * Compute an optimal RTC_CENTER for a set of vertices.
 * Uses the bounding box center for maximum precision benefit.
 */
export function computeRTCCenter(vertices: Float32Array): Vec3 {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    z: (minZ + maxZ) / 2,
  };
}
