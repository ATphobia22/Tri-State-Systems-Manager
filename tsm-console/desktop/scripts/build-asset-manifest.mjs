#!/usr/bin/env node
/**
 * build-asset-manifest.mjs — deterministic inventory of everything bundled
 * into the TSM desktop app (SPA dist, server, data).
 *
 * Walks the packaged inputs, records { path, bytes, sha256 } sorted by path,
 * and writes:
 *   - desktop/assets/asset-manifest.json  (bundled inside the app for audit)
 *   - release/SHA256SUMS                  (next to the built .exe)
 *
 * Deterministic: fixed sort order, no timestamps in the manifest body.
 * Precision metadata (units, CRS, nodata, provenance) lives with the datasets
 * themselves; this manifest proves *which bytes* shipped.
 */
import { createHash } from 'node:crypto';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');
const CONSOLE = join(REPO, 'tsm-console');
const DESKTOP = join(CONSOLE, 'desktop');

const INPUTS = [
  { dir: join(CONSOLE, 'dist'), prefix: 'app/dist' },
  { dir: join(CONSOLE, 'server'), prefix: 'app/server' },
  { dir: join(REPO, 'data'), prefix: 'app/data' },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function sha256File(full) {
  const hash = createHash('sha256');
  hash.update(readFileSync(full));
  return hash.digest('hex');
}

const entries = [];
for (const { dir, prefix } of INPUTS) {
  let files = [];
  try {
    files = walk(dir);
  } catch (error) {
    console.error(`input missing (skipped): ${dir}`);
    continue;
  }
  for (const full of files) {
    const rel = relative(dir, full).replace(/\\/g, '/');
    entries.push({ path: `${prefix}/${rel}`, bytes: statSync(full).size, sha256: sha256File(full) });
  }
}
entries.sort((a, b) => a.path.localeCompare(b.path));

const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
const manifest = {
  format: 'tsm-asset-manifest-v1',
  app: 'tsm-desktop',
  entries,
  fileCount: entries.length,
  totalBytes,
};

const manifestPath = join(DESKTOP, 'assets', 'asset-manifest.json');
mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

const releaseDir = join(DESKTOP, 'release');
mkdirSync(releaseDir, { recursive: true });
const sumsPath = join(releaseDir, 'SHA256SUMS.in');
writeFileSync(sumsPath, manifest.entries.map((e) => `${e.sha256}  ${e.path}`).join('\n') + '\n');

console.log(JSON.stringify({ manifest: manifestPath, files: entries.length, totalBytes, totalMiB: Number((totalBytes / 1048576).toFixed(1)) }));
