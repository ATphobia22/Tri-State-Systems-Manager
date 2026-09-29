/**
 * quantized-grid.ts — decode side of the "turbo quant" elevation pipeline.
 *
 * The "turbovec" half: decoding is one sequential pass over a Uint16Array into
 * a Float64Array (`min + q * scale`). No branches, no allocations inside the
 * loop, cache-friendly linear access — the shape vectorizers and JITs like.
 *
 * Bundles are produced by scripts/geospatial/quantize-grid.mjs and carry their
 * own provenance metadata plus the sha256 of the original float-grid source,
 * so the data-quality contract labels survive quantization.
 */

export interface QuantizedGridBundle {
  readonly id?: string;
  readonly kind?: string;
  readonly n?: number;
  readonly cellFt?: number;
  readonly halfExtentFt?: number;
  readonly verticalDatum?: string;
  readonly horizontalDatum?: string;
  readonly source?: string;
  readonly units?: string;
  readonly sha256?: string;
  readonly sourceSha256?: string;
  readonly statsFt?: { readonly min?: number; readonly max?: number; readonly mean?: number };
  readonly quant?: {
    readonly encoding?: string;
    readonly min?: number;
    readonly max?: number;
    readonly scale?: number;
    readonly count?: number;
    readonly maxRoundTripErrorUnits?: number;
  };
  readonly data?: string;
}

export interface DecodedGrid {
  /** Row-major elevation samples, length n*n, in bundle units. */
  readonly values: Float64Array;
  readonly n: number;
  readonly quantum: number;
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Decode a quantized grid bundle. Throws on malformed input (fail-closed). */
export function decodeQuantizedGrid(bundle: QuantizedGridBundle): DecodedGrid {
  const n = bundle.n;
  const q = bundle.quant;
  const data = bundle.data;
  if (!Number.isInteger(n) || (n as number) < 2) throw new Error('quantized grid: invalid n');
  if (q?.encoding !== 'uint16-le') throw new Error('quantized grid: unsupported encoding');
  const min = q.min;
  const scale = q.scale;
  const count = q.count;
  if (typeof min !== 'number' || typeof scale !== 'number' || !(scale > 0)) {
    throw new Error('quantized grid: invalid quant parameters');
  }
  if (typeof count !== 'number' || count !== (n as number) * (n as number)) throw new Error('quantized grid: count mismatch');
  if (typeof data !== 'string' || data.length === 0) throw new Error('quantized grid: missing data');

  const bytes = base64ToBytes(data);
  if (bytes.byteLength !== count * 2) throw new Error('quantized grid: payload size mismatch');
  const quants = new Uint16Array(bytes.buffer, bytes.byteOffset, count);
  const values = new Float64Array(count);
  // Vectorized decode: min + q*scale. Sequential, branchless, SIMD-friendly.
  for (let i = 0; i < quants.length; i += 1) {
    values[i] = min + quants[i] * scale;
  }
  return { values, n: n as number, quantum: scale };
}

/** Encode a float grid (used by tests and tooling; the CLI script is canonical). */
export function encodeQuantizedGrid(values: ArrayLike<number>): { quants: Uint16Array; min: number; scale: number; maxError: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (!Number.isFinite(v)) throw new Error('encode: non-finite sample');
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min;
  if (!(range > 0)) throw new Error('encode: zero range');
  const scale = range / 65535;
  const quants = new Uint16Array(values.length);
  let maxError = 0;
  for (let i = 0; i < values.length; i += 1) {
    const qi = Math.round((values[i] - min) / scale);
    quants[i] = qi;
    const err = Math.abs(min + qi * scale - values[i]);
    if (err > maxError) maxError = err;
  }
  return { quants, min, scale, maxError };
}
