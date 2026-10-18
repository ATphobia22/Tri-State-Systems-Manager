/**
 * Relative-To-Center (RTC) geometry transform for TSM mesh / WebGPU paths.
 * Re-centers high-magnitude geospatial coordinates to a local origin before
 * float32 GPU upload to eliminate vertex jitter at municipal scale.
 *
 * Contract:
 *   - Input positions are double-precision Cartesian (meters preferred) or
 *     lon/lat/height when using fromGeodeticDegrees.
 *   - Output relative positions are float32-safe; model matrix restores world pose.
 *   - Fail-closed on empty arrays, non-finite values, and length not divisible by 3.
 */

export type Vec3 = readonly [number, number, number];

export interface RtcResult {
  /** float32 relative positions (x,y,z interleaved) */
  relative: Float32Array;
  /** world-space origin used for recenter */
  center: Vec3;
  /** column-major 4x4 translation matrix placing local mesh into world */
  modelMatrix: Float32Array;
  vertexCount: number;
}

export class RtcTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RtcTransformError';
  }
}

function assertFiniteTriplet(x: number, y: number, z: number, index: number): void {
  if (![x, y, z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    throw new RtcTransformError(`Non-finite vertex at index ${index}: (${x}, ${y}, ${z})`);
  }
}

export function computeCentroid(positions: ArrayLike<number>): Vec3 {
  const n = positions.length;
  if (n === 0 || n % 3 !== 0) {
    throw new RtcTransformError(`positions length must be a positive multiple of 3, got ${n}`);
  }
  let sx = 0;
  let sy = 0;
  let sz = 0;
  const count = n / 3;
  for (let i = 0; i < n; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    assertFiniteTriplet(x, y, z, i / 3);
    sx += x;
    sy += y;
    sz += z;
  }
  return [sx / count, sy / count, sz / count];
}

export function translationMatrix(center: Vec3): Float32Array {
  const [cx, cy, cz] = center;
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    cx, cy, cz, 1,
  ]);
}

export function toRtcPositions(
  positions: ArrayLike<number>,
  origin?: Vec3,
): RtcResult {
  const n = positions.length;
  if (n === 0 || n % 3 !== 0) {
    throw new RtcTransformError(`positions length must be a positive multiple of 3, got ${n}`);
  }
  const center = origin ?? computeCentroid(positions);
  const [cx, cy, cz] = center;
  if (![cx, cy, cz].every((v) => Number.isFinite(v))) {
    throw new RtcTransformError(`Invalid RTC origin: (${cx}, ${cy}, ${cz})`);
  }

  const relative = new Float32Array(n);
  let maxAbs = 0;
  for (let i = 0; i < n; i += 3) {
    const x = positions[i] - cx;
    const y = positions[i + 1] - cy;
    const z = positions[i + 2] - cz;
    assertFiniteTriplet(x + cx, y + cy, z + cz, i / 3);
    relative[i] = x;
    relative[i + 1] = y;
    relative[i + 2] = z;
    maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y), Math.abs(z));
  }

  if (maxAbs > 1e6) {
    throw new RtcTransformError(
      `RTC span ${maxAbs} m exceeds safe single-tile bound (1e6 m); split the mesh`,
    );
  }

  return {
    relative,
    center,
    modelMatrix: translationMatrix(center),
    vertexCount: n / 3,
  };
}

export function fromRtcPositions(relative: ArrayLike<number>, center: Vec3): Float64Array {
  const n = relative.length;
  if (n === 0 || n % 3 !== 0) {
    throw new RtcTransformError(`relative length must be a positive multiple of 3, got ${n}`);
  }
  const [cx, cy, cz] = center;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 3) {
    out[i] = relative[i] + cx;
    out[i + 1] = relative[i + 1] + cy;
    out[i + 2] = relative[i + 2] + cz;
  }
  return out;
}

export function rtcForGpuUpload(
  positions: Float64Array | number[],
  origin?: Vec3,
): { positionAttribute: Float32Array; modelMatrix: Float32Array; center: Vec3 } {
  const result = toRtcPositions(positions, origin);
  return {
    positionAttribute: result.relative,
    modelMatrix: result.modelMatrix,
    center: result.center,
  };
}
