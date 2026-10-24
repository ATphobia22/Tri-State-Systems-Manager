import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const workspaceRoots = ['apps', 'packages', 'providers', 'plugins'];
const manifests = [];

function collect(directory) {
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      const manifestPath = join(path, 'package.json');
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        manifests.push({ path: relative(root, manifestPath), manifest });
      } catch {
        collect(path);
      }
    }
  }
}

for (const workspaceRoot of workspaceRoots) {
  const path = join(root, workspaceRoot);
  try { collect(path); } catch { /* Optional workspace directory. */ }
}

test('local workspace dependency declarations are npm-compatible and version-aligned', () => {
  const localPackages = new Map();
  for (const { path, manifest } of manifests) {
    if (typeof manifest.name === 'string' && typeof manifest.version === 'string') {
      assert.ok(!localPackages.has(manifest.name), `duplicate workspace package name: ${manifest.name}`);
      localPackages.set(manifest.name, { version: manifest.version, path });
    }
  }

  const issues = [];
  for (const { path, manifest } of manifests) {
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [name, spec] of Object.entries(manifest[section] ?? {})) {
        const local = localPackages.get(name);
        if (!local) continue;
        if (typeof spec !== 'string' || spec.startsWith('workspace:')) {
          issues.push(`${path}: ${section}.${name} uses unsupported npm workspace spec ${String(spec)}`);
          continue;
        }
        const match = spec.match(/^(\^|~)?(\d+)\.(\d+)\.(\d+)$/);
        const version = local.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
        if (!match || !version) {
          issues.push(`${path}: ${section}.${name} must use a plain semver range; found ${spec}`);
          continue;
        }
        const [, operator = '', major, minor, patch] = match;
        const [, localMajor, localMinor, localPatch] = version;
        const sameMajor = major === localMajor;
        const sameMinor = minor === localMinor;
        const samePatch = patch === localPatch;
        const compatible = operator === '^'
          ? (sameMajor && (Number(major) > 0 || sameMinor && samePatch))
          : operator === '~'
            ? sameMajor && sameMinor
            : sameMajor && sameMinor && samePatch;
        if (!compatible) {
          issues.push(`${path}: ${section}.${name} range ${spec} does not match local ${local.version} (${local.path})`);
        }
      }
    }
  }
  assert.deepEqual(issues, []);
});
