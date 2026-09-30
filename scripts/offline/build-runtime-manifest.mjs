import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const runtimeRoot = join(root, 'offline-runtime');
const manifestRoot = join(runtimeRoot, 'manifests');

function hash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

for (const required of [
  join(root, 'tsm-console', 'dist', 'index.html'),
  join(runtimeRoot, 'npm-cache'),
  join(runtimeRoot, 'python-wheels'),
  join(runtimeRoot, 'native', 'cargo-vendor'),
]) {
  if (!existsSync(required)) throw new Error('Missing offline runtime artifact: ' + required);
}

const files = walk(runtimeRoot)
  .filter((path) => !path.endsWith('runtime-manifest.json') && !path.endsWith('SHA256SUMS'))
  .map((path) => ({
    path: relative(root, path).replaceAll('\\\\', '/'),
    bytes: statSync(path).size,
    sha256: hash(path),
  }));

const manifest = {
  schemaVersion: 'tsm-offline-runtime-v1',
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? 'local',
  node: process.version,
  runtimePlanes: [
    'doctor',
    'offline-dependency-cache',
    'vite-web-build',
    'node-api-runtime',
    'health-verification',
    'hydraulics-contracts-and-hdf5-reader',
    'tauri-cargo-vendor',
    'provenance-and-checksums',
    'authorized-hec-ras-boundary',
  ],
  offlineInstallation: {
    npm: 'npm ci --offline --cache offline-runtime/npm-cache',
    python: 'python -m pip install --no-index --find-links offline-runtime/python-wheels -r packages/hydraulics/python/requirements.txt',
    rust: 'cargo build --offline --manifest-path tsm-console/src-tauri/Cargo.toml',
  },
  files,
};

writeFileSync(join(manifestRoot, 'runtime-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(join(manifestRoot, 'SHA256SUMS'), files.map((entry) => entry.sha256 + '  ' + entry.path).join('\n') + '\n');
console.log('Offline runtime manifest generated: ' + files.length + ' files');
