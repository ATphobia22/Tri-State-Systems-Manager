import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifests = [
  'apps/admin/package.json',
  'apps/dashboard/package.json',
  'apps/playground/package.json',
  'packages/agent-runtime/package.json',
  'packages/jobs/package.json',
  'packages/approvals/package.json',
  'packages/notifications/package.json',
  'packages/queues/package.json',
];
const root = new URL('../../', import.meta.url);

async function readManifest(path) {
  return JSON.parse(await readFile(new URL(path, root), 'utf8'));
}

test('all internal workspace dependencies use npm-compatible semver, not workspace protocol', async () => {
  const loaded = await Promise.all(manifests.map(async (path) => ({ path, manifest: await readManifest(path) })));
  const byName = new Map(loaded.map(({ manifest }) => [manifest.name, manifest]));
  for (const { path, manifest } of loaded) {
    for (const [dependency, specifier] of Object.entries(manifest.dependencies ?? {})) {
      if (!dependency.startsWith('@tsm/')) continue;
      assert.equal(typeof specifier, 'string', `${path}: ${dependency} must have a string version`);
      assert.doesNotMatch(specifier, /^workspace:/, `${path}: npm 10 does not accept workspace protocol here`);
      assert.match(specifier, /^\^\d+\.\d+\.\d+$/, `${path}: ${dependency} must use an explicit semver range`);
      const target = byName.get(dependency);
      assert.ok(target, `${path}: workspace dependency ${dependency} has no manifest in the contract list`);
      assert.equal(specifier, `^${target.version}`, `${path}: ${dependency} range must track the local package version`);
    }
  }
});
