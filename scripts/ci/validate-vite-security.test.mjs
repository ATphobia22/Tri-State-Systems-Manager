import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(root, 'tsm-console/package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(resolve(root, 'tsm-console/package-lock.json'), 'utf8'));

function tuple(version) {
  assert.match(version, /^\d+\.\d+\.\d+$/, 'Use a concrete resolved package version');
  return version.split('.').map(Number);
}

function atLeast(version, minimum) {
  const actual = tuple(version);
  const target = tuple(minimum);
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== target[i]) return actual[i] > target[i];
  }
  return true;
}

test('Vite resolves to a release patched against GHSA-p4f5-76q4-ffq7', () => {
  const pkg = lock.packages['node_modules/vite'];
  assert.ok(pkg, 'Vite must exist in the npm lock');
  assert.ok(atLeast(pkg.version, '8.3.7'), 'Vite 8.3.6 is vulnerable; use >=8.3.7');
  assert.ok(atLeast(manifest.devDependencies.vite, '8.3.7'),
    'Manifest must pin a release newer than vulnerable Vite 8.3.6');
  assert.equal(lock.packages[''].devDependencies.vite, manifest.devDependencies.vite);
});

test('Rolldown resolves the patched native bundler used by Vite 8.3.x', () => {
  const bundler = lock.packages['node_modules/rolldown'];
  assert.ok(bundler, 'Rolldown must exist in the npm lock');
  assert.ok(atLeast(bundler.version, '1.2.17'), 'Rolldown 1.2.16 predates the security fix');
  assert.match(lock.packages['node_modules/vite'].dependencies.rolldown, /1\.2\.(1[7-9]|[2-9]\d)/);
});
