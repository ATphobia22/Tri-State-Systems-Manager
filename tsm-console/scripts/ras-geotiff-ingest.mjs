/**
 * Optimized HEC-RAS GeoTIFF → POST /api/engineering/ras-results
 * - Single bulk readRasters (not per-pixel await)
 * - Spatial stride downsample for twin (default maxDim 128)
 * - Optional nodata skip
 * - BFE/LAG stamped from Bonebank constants (not inferred from raster)
 *
 * Usage:
 *   node scripts/ras-geotiff-ingest.mjs ./depth.tif --plan=posey-q100 --api=http://localhost:8787
 *   node scripts/ras-geotiff-ingest.mjs ./depth.tif --plan=posey-q100 --maxDim=128 --meters --dry-run
 *
 * Requires: npm i geotiff
 *
 * authority_class: DERIVATION / MODEL for downsampled cells.
 * Native analysis CRS for site work remains EPSG:2966 / NAVD88.
 * GeoTIFF bbox is whatever RAS Mapper exported — record native CRS; do not assume 4326.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const planId =
  args.find((a) => a.startsWith('--plan='))?.split('=')[1] ||
  path.basename(file || 'plan', path.extname(file || 'plan'));
const api =
  args.find((a) => a.startsWith('--api='))?.split('=')[1] || 'http://localhost:8787';
const maxDim = Number(args.find((a) => a.startsWith('--maxDim='))?.split('=')[1] || 128);
const meters = args.includes('--meters');
const dryRun = args.includes('--dry-run');

const BFE_NAVD88_FT = 375.0;
const LAG_NAVD88_FT = 377.2;
const GAGE_ID = '03378500';

if (!file || !fs.existsSync(file)) {
  console.error(
    'Usage: node scripts/ras-geotiff-ingest.mjs <depth.tif> [--plan=id] [--maxDim=128] [--meters] [--dry-run] [--api=url]'
  );
  process.exit(1);
}

let fromArrayBuffer;
try {
  ({ fromArrayBuffer } = await import('geotiff'));
} catch {
  console.error('Install geotiff: npm i geotiff');
  process.exit(1);
}

const fileBuf = fs.readFileSync(file);
const contentHash = createHash('sha256').update(fileBuf).digest('hex');
const ab = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
const tiff = await fromArrayBuffer(ab);
const image = await tiff.getImage();
const width = image.getWidth();
const height = image.getHeight();
const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY] native CRS
const [minX, minY, maxX, maxY] = bbox;
const geoKeys = image.getGeoKeys?.() ?? null;

const strideX = Math.max(1, Math.ceil(width / maxDim));
const strideY = Math.max(1, Math.ceil(height / maxDim));

console.log(
  JSON.stringify(
    {
      file,
      content_hash_sha256: contentHash,
      width,
      height,
      strideX,
      strideY,
      bbox,
      geoKeys_hint: geoKeys,
      planId,
      note: 'bbox axes are native GeoTIFF CRS — may be 2966 ftUS, not lon/lat',
    },
    null,
    2
  )
);

const rasters = await image.readRasters();
const band = rasters[0];
const noData = image.getGDALNoData?.() ?? null;

const cells = [];
for (let y = 0; y < height; y += strideY) {
  for (let x = 0; x < width; x += strideX) {
    const v = Number(band[y * width + x]);
    if (!Number.isFinite(v)) continue;
    if (noData != null && v === Number(noData)) continue;
    if (v <= 0) continue;
    const depth_ft = meters ? v * 3.28084 : v;
    // Sample center in native CRS units (NOT assumed geographic)
    const cx = minX + ((maxX - minX) * (x + 0.5)) / width;
    const cy = minY + ((maxY - minY) * (y + 0.5)) / height;
    cells.push({
      id: `${planId}_${x}_${y}`,
      x_native: cx,
      y_native: cy,
      // legacy twin fields — only valid if export CRS is geographic
      lon: cx,
      lat: cy,
      depth_ft,
      wse_ft: undefined,
    });
  }
}

const body = {
  meta: {
    plan_id: planId,
    source: `geotiff:${path.basename(file)}`,
    content_hash_sha256: contentHash,
    model_note: `stride ${strideX}x${strideY} from ${width}x${height}`,
    units: 'feet',
    gage_id: GAGE_ID,
    authority_class: 'DERIVATION',
    derivation_class: 'HEC_RAS_DEPTH_DOWNSAMPLE',
    is_simulation_demo: false,
    horizontal_crs_note:
      'Record native GeoTIFF CRS from RAS Mapper; analysis frame remains EPSG:2966 / NAVD88',
  },
  cells,
  bfe_navd88_ft: BFE_NAVD88_FT,
  lag_navd88_ft: LAG_NAVD88_FT,
};

if (dryRun) {
  console.log(
    JSON.stringify(
      { dry_run: true, cells: cells.length, sample: cells.slice(0, 3), meta: body.meta },
      null,
      2
    )
  );
  process.exit(0);
}

const res = await fetch(`${api}/api/engineering/ras-results`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
let out;
try {
  out = await res.json();
} catch {
  out = { raw: await res.text() };
}
console.log(JSON.stringify({ status: res.status, cells: cells.length, response: out }, null, 2));
if (!res.ok) process.exit(1);
