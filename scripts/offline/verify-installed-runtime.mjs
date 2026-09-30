import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const runtime = join(root, 'offline-runtime');
const required = [
  'manifests/runtime-manifest.json',
  'manifests/SHA256SUMS',
  'npm-cache',
  'python-wheels',
  'native/cargo-vendor',
];

for (const relative of required) {
  const path = join(runtime, relative);
  if (!existsSync(path)) throw new Error('Missing installed runtime artifact: ' + relative);
  if (statSync(path).isFile() && statSync(path).size === 0) throw new Error('Empty installed runtime artifact: ' + relative);
}

const manifest = JSON.parse(readFileSync(join(runtime, 'manifests/runtime-manifest.json'), 'utf8'));
if (!['tsm-offline-runtime-v1', 'tsm-offline-runtime-windows-x64-v1'].includes(manifest.schemaVersion)) throw new Error('Unsupported runtime manifest schema.');
if (manifest.schemaVersion === 'tsm-offline-runtime-windows-x64-v1' && manifest.platform !== 'windows-x64') throw new Error('Windows runtime manifest platform mismatch.');
if (!Array.isArray(manifest.planes) && !Array.isArray(manifest.runtimePlanes)) throw new Error('Runtime planes are missing.');

console.log('TSM installed offline runtime: PASS');
console.log('Schema:', manifest.schemaVersion);
console.log('Runtime root:', runtime);
