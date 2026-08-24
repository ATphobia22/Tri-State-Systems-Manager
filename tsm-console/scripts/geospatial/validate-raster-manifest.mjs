#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = path.resolve(process.argv[2] || path.join(ROOT, 'data/geospatial/cache/posey-2020/asset-download-manifest.json'));

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
if (manifest.horizontalCrs !== 'EPSG:2966') throw new Error('manifest CRS is not EPSG:2966');
if (manifest.verticalDatum !== 'NAVD88') throw new Error('manifest vertical datum is not NAVD88');
if (manifest.siteBounds?.minX !== 2680000 || manifest.siteBounds?.minY !== 940000 || manifest.siteBounds?.maxX !== 2685000 || manifest.siteBounds?.maxY !== 945000) {
  throw new Error('manifest site bounds do not match the registered 5,000-ft Posey AOI');
}

for (const [name, asset] of Object.entries(manifest.assets || {})) {
  const absolutePath = path.resolve(ROOT, asset.path);
  const bytes = await readFile(absolutePath);
  const actual = sha256(bytes);
  if (actual !== asset.sha256) throw new Error(`${name} SHA-256 mismatch: expected ${asset.sha256}, got ${actual}`);
  if (asset.authorityClass !== 'OBSERVATION' || asset.derivationClass !== 'RAW') throw new Error(`${name} provenance class is not OBSERVATION/RAW`);
}

if (!String(manifest.referenceLidarUri).endsWith('IN2020_26800940_12.las')) throw new Error('reference LiDAR tile is not pinned');
console.log(JSON.stringify({ ok: true, manifest: MANIFEST, assets: Object.keys(manifest.assets) }, null, 2));
