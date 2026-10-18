#!/usr/bin/env node
/**
 * Enforce byte parity for repository files intentionally mirrored into the
 * public console bundle. This checks drift; it never copies or rewrites data.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const pairs = [
  {
    source: 'data/posey-county/reference/usgs-24k-quadrangle-boundaries.geojson',
    published: 'tsm-console/public/reference/usgs-24k-quadrangle-boundaries.geojson',
    purpose: 'USGS quadrangle boundary reference data',
  },
  {
    source: 'data/usace-nld/leveed-areas-wabash-v1.geojson',
    published: 'tsm-console/public/data/leveed-areas-wabash-v1.geojson',
    purpose: 'USACE NLD leveed-area GeoJSON',
  },
  {
    source: 'data/usace-nld/PROVENANCE.md',
    published: 'tsm-console/public/data/leveed-areas-wabash-PROVENANCE.md',
    purpose: 'USACE NLD leveed-area provenance',
  },
  {
    source: 'tsm-authority-registry-v35.json',
    published: 'tsm-console/data/authority/tsm-authority-registry-v35.json',
    purpose: 'TSM authority registry v35',
  },
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

let failures = 0;
for (const pair of pairs) {
  const sourcePath = path.join(root, pair.source);
  const publishedPath = path.join(root, pair.published);
  let source;
  let published;

  try {
    [source, published] = await Promise.all([
      readFile(sourcePath),
      readFile(publishedPath),
    ]);
  } catch (error) {
    failures += 1;
    console.error(
      `FAIL ${pair.purpose}: missing/unreadable source copy (${error instanceof Error ? error.message : String(error)})`,
    );
    continue;
  }

  const sourceHash = sha256(source);
  const publishedHash = sha256(published);
  if (sourceHash !== publishedHash) {
    failures += 1;
    console.error(
      `FAIL ${pair.purpose}: copies differ; source=${sourceHash}, published=${publishedHash}`,
    );
    continue;
  }

  console.log(`PASS ${pair.purpose}: sha256=${sourceHash}`);
}

if (failures > 0) {
  console.error(`Data-copy parity failed for ${failures} pair(s).`);
  process.exitCode = 1;
} else {
  console.log(`Data-copy parity passed for all ${pairs.length} intentional mirrors.`);
}
