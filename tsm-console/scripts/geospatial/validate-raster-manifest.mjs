#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = path.resolve(process.argv[2] || path.join(ROOT, 'data/geospatial/cache/posey-2020/asset-download-manifest.json'));
const EXPECTED_BOUNDS = [2680000, 940000, 2685000, 945000];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertClose(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
if (manifest.horizontalCrs !== 'EPSG:2966') throw new Error('manifest CRS is not EPSG:2966');
if (manifest.verticalDatum !== null && manifest.verticalDatum !== 'NAVD88') throw new Error('manifest vertical datum must be NAVD88 or null when unverified');
if (manifest.verticalDatumVerified !== (manifest.verticalDatum === 'NAVD88')) throw new Error('manifest verticalDatumVerified flag is inconsistent');
if (manifest.siteBounds?.minX !== EXPECTED_BOUNDS[0] || manifest.siteBounds?.minY !== EXPECTED_BOUNDS[1] || manifest.siteBounds?.maxX !== EXPECTED_BOUNDS[2] || manifest.siteBounds?.maxY !== EXPECTED_BOUNDS[3]) {
  throw new Error('manifest site bounds do not match the registered 5,000-ft Posey AOI');
}

for (const [name, asset] of Object.entries(manifest.assets || {})) {
  const absolutePath = path.resolve(ROOT, asset.path);
  const bytes = await readFile(absolutePath);
  const actual = sha256(bytes);
  if (actual !== asset.sha256) throw new Error(`${name} SHA-256 mismatch: expected ${asset.sha256}, got ${actual}`);
  if (asset.authorityClass !== 'OBSERVATION' || asset.derivationClass !== 'RAW') throw new Error(`${name} provenance class is not OBSERVATION/RAW`);

  if (name === 'terrain') {
    const tiff = await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    const image = await tiff.getImage();
    if (image.getWidth() !== 2048 || image.getHeight() !== 2048) throw new Error(`terrain raster dimensions must be 2048×2048, got ${image.getWidth()}×${image.getHeight()}`);
    const bbox = image.getBoundingBox();
    for (let index = 0; index < 4; index += 1) assertClose(bbox[index], EXPECTED_BOUNDS[index], 1, `terrain bbox[${index}]`);
    const geoKeys = image.getGeoKeys();
    if (!geoKeys || Number(geoKeys.ProjectedCSTypeGeoKey) !== 2966) throw new Error(`terrain GeoTIFF ProjectedCSTypeGeoKey must be 2966, got ${geoKeys?.ProjectedCSTypeGeoKey}`);
    const verticalCrs = Number(geoKeys.VerticalCSTypeGeoKey);
    const explicitNavd88 = verticalCrs === 5703 || verticalCrs === 6360;
    if (manifest.verticalDatum === 'NAVD88' && !explicitNavd88) {
      throw new Error(`manifest claims NAVD88 but terrain GeoTIFF does not declare EPSG:5703 or EPSG:6360 (got ${geoKeys.VerticalCSTypeGeoKey})`);
    }
  }
}

if (!String(manifest.referenceLidarUri).endsWith('IN2020_26800940_12.las')) throw new Error('reference LiDAR tile is not pinned');
console.log(JSON.stringify({ ok: true, manifest: MANIFEST, assets: Object.keys(manifest.assets) }, null, 2));
