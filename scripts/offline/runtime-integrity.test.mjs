import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { extractRuntimeChecksums, parseSha256Sums, safeArtifactPath, verifyOfflineRuntime } from './runtime-integrity.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tsm-runtime-integrity-'));
  const data = join(root, 'offline-runtime');
  for (const path of ['npm-cache', 'python-wheels', 'native/cargo-vendor', 'manifests']) {
    mkdirSync(join(data, path), { recursive: true });
  }
  mkdirSync(join(root, 'tsm-console', 'dist'), { recursive: true });
  const artifact = 'tsm-console/dist/index.html';
  const bytes = '<html>test</html>';
  writeFileSync(join(root, artifact), bytes);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const sums = join(data, 'manifests', 'SHA256SUMS');
  const manifest = join(data, 'manifests', 'runtime-manifest.json');
  writeFileSync(manifest, JSON.stringify({
    schemaVersion: 'tsm-offline-runtime-windows-x64-v1',
    platform: 'windows-x64',
    planes: ['vite-web', 'provenance'],
  }));
  writeFileSync(sums, digest + '  ' + artifact + '\n');
  return { root, data, artifact, sums, manifest, digest };
}

test('runtime verifier hashes actual bytes and reports measured inventory', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const report = await verifyOfflineRuntime(f.root);
  assert.equal(report.filesVerified, 1);
  assert.equal(report.bytesVerified, 17);
  assert.equal(report.schemaVersion, 'tsm-offline-runtime-windows-x64-v1');
});

test('modified payload must fail even with unchanged metadata and paths', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  writeFileSync(join(f.root, f.artifact), '<html>evil</html>');
  await assert.rejects(verifyOfflineRuntime(f.root), /SHA-256 mismatch/);
});

test('checksum inventory rejects traversal, absolute paths and malformed SHA', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  for (const p of ['../outside', '/etc/passwd', 'C:/Windows/System32/test.exe', 'folder//file']) {
    assert.throws(() => safeArtifactPath(f.root, p));
  }
  assert.throws(() => parseSha256Sums('1234  tsm-console/dist/index.html\n'), /Malformed/);
  assert.throws(() => extractRuntimeChecksums(f.root, { files: [{ path: f.artifact, sha256: 'invalid' }] }));
  writeFileSync(f.sums, f.digest + '  ../escape\n');
  await assert.rejects(verifyOfflineRuntime(f.root), /traversal/);
});

test('checksum conflict and incorrect byte length cannot pass', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const json = JSON.parse(readFileSync(f.manifest, 'utf8'));
  json.files = [{ path: f.artifact, sha256: 'f'.repeat(64) }];
  writeFileSync(f.manifest, JSON.stringify(json));
  await assert.rejects(verifyOfflineRuntime(f.root), /Conflicting checksum/);
  json.files = [{ path: f.artifact, sha256: f.digest, bytes: 1 }];
  writeFileSync(f.manifest, JSON.stringify(json));
  await assert.rejects(verifyOfflineRuntime(f.root), /Byte count mismatch/);
});

test('symlinked manifest payload is forbidden', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  writeFileSync(join(f.root, 'real.txt'), 'data');
  symlinkSync(join(f.root, 'real.txt'), join(f.data, 'native', 'cargo-vendor', 'alias.txt'));
  assert.throws(() => safeArtifactPath(f.root, 'offline-runtime/native/cargo-vendor/alias.txt'), /Symlink/);
});

test('runtime manifest declares Windows only when the platform matches', async t => {
  const f = fixture();
  t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const manifest = JSON.parse(readFileSync(f.manifest, 'utf8'));
  manifest.platform = 'linux-x64';
  writeFileSync(f.manifest, JSON.stringify(manifest));
  await assert.rejects(verifyOfflineRuntime(f.root), /platform mismatch/);
});
