#!/usr/bin/env node
import { access, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const manifestsDir = resolve(ROOT, 'integrations/manifests');

try {
  await access(manifestsDir);
} catch {
  console.log('No generated asset manifests are present; contract gate remains satisfied.');
  process.exit(0);
}

const errors = [];
for (const name of await readdir(manifestsDir)) {
  if (!name.endsWith('.json')) continue;
  const path = resolve(manifestsDir, name);
  const item = JSON.parse(await readFile(path, 'utf8'));
  for (const key of ['asset_id', 'format', 'source_crs', 'target_crs', 'vertical_datum', 'toolchain', 'sha256', 'provenance']) {
    if (!(key in item)) errors.push(`${name}: missing ${key}`);
  }
  if (!/^[0-9a-f]{64}$/.test(item.sha256 ?? '')) errors.push(`${name}: invalid SHA-256`);
  if (!Array.isArray(item.toolchain) || item.toolchain.length === 0) errors.push(`${name}: toolchain must be non-empty`);
  if (item.source_crs === item.target_crs) {
    console.log(`${name}: source and target CRS identical; no reprojection recorded.`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`ASSET MANIFEST ERROR: ${error}`));
  process.exit(1);
}
console.log('3D asset manifest contract checks passed.');
