#!/usr/bin/env node
/**
 * quantize-grid.mjs — "turbo quant" for elevation grids.
 *
 * Converts a float elevation grid JSON ({ gridFt: number[], ...meta }) into a
 * compact quantized bundle: uint16 little-endian samples + min/scale, base64
 * embedded. Decoding is a single vectorized typed-array pass
 * (see tsm-console/src/lib/quantized-grid.ts — the "turbovec" half).
 *
 * Precision: uint16 over the grid's own [min,max] range. For the Posey
 * screening grid (34.8 ft range) the quantum is ~0.0005 ft — orders of
 * magnitude below the 62.5 ft cell size and the screening-level data quality.
 * Max round-trip error is recorded in the bundle metadata and asserted by tests.
 *
 * Usage:
 *   node scripts/geospatial/quantize-grid.mjs \
 *     tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, basename, join } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('usage: quantize-grid.mjs <grid.json>');
  process.exit(2);
}

const raw = readFileSync(inputPath, 'utf8');
const bundle = JSON.parse(raw);
const grid = bundle.gridFt;
if (!Array.isArray(grid) || grid.length === 0 || !grid.every(Number.isFinite)) {
  throw new Error('gridFt must be a non-empty array of finite numbers');
}

let min = Infinity;
let max = -Infinity;
for (let i = 0; i < grid.length; i += 1) {
  const v = grid[i];
  if (v < min) min = v;
  if (v > max) max = v;
}
const range = max - min;
if (!(range > 0)) throw new Error('grid has zero range; nothing to quantize');

const scale = range / 65535;
const quants = new Uint16Array(grid.length);
// Vectorized quantize: sequential typed-array pass, no branches in the loop.
for (let i = 0; i < grid.length; i += 1) {
  quants[i] = Math.round((grid[i] - min) / scale);
}

let maxError = 0;
for (let i = 0; i < grid.length; i += 1) {
  const err = Math.abs(min + quants[i] * scale - grid[i]);
  if (err > maxError) maxError = err;
}

const bytes = Buffer.from(quants.buffer, quants.byteOffset, quants.byteLength);
const originalSha256 = createHash('sha256').update(raw).digest('hex');

const out = {
  id: bundle.id,
  kind: 'quantized-grid-v1',
  description: bundle.description,
  source: bundle.source,
  n: bundle.n,
  cellFt: bundle.cellFt,
  halfExtentFt: bundle.halfExtentFt,
  verticalDatum: bundle.verticalDatum,
  horizontalDatum: bundle.horizontalDatum,
  units: bundle.units ?? 'ft',
  layout: bundle.layout,
  statsFt: bundle.statsFt,
  quant: {
    encoding: 'uint16-le',
    min,
    max,
    scale,
    count: grid.length,
    maxRoundTripErrorUnits: maxError,
  },
  // Provenance chain: sha256 of the original float-grid source document.
  sourceSha256: bundle.sha256 ?? originalSha256,
  data: bytes.toString('base64'),
};

const outPath = join(dirname(inputPath), basename(inputPath, '.json') + '.q16.json');
writeFileSync(outPath, JSON.stringify(out));
const beforeBytes = Buffer.byteLength(raw);
const afterBytes = Buffer.byteLength(JSON.stringify(out));
console.log(JSON.stringify({
  outPath,
  samples: grid.length,
  beforeBytes,
  afterBytes,
  ratio: Number((beforeBytes / afterBytes).toFixed(2)),
  quantumUnits: scale,
  maxRoundTripErrorUnits: maxError,
}, null, 2));
