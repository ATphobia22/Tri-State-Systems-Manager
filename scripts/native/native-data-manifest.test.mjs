import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { generateNativeDataManifest, verifyNativeDataManifest } from './native-data-manifest.mjs';
import { stageNativeData } from './stage-native-data-root.mjs';

function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsm-data-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'source');
  fs.mkdirSync(path.join(root, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'nested', 'terrain.bin'), Buffer.from([1, 2, 3, 4]));
  const manifestPath = path.join(root, 'data-manifest.json');
  generateNativeDataManifest({ dataRoot: root, manifestPath });
  return { temp, root, manifestPath, options: { dataRoot: root, manifestPath } };
}
function editManifest(f, update) { const doc = JSON.parse(fs.readFileSync(f.manifestPath)); update(doc); fs.writeFileSync(f.manifestPath, JSON.stringify(doc)); }

test('strict verification accepts its own manifest and generation is repeatable', t => {
  const f = fixture(t);
  const first = fs.readFileSync(f.manifestPath, 'utf8');
  const receipt = verifyNativeDataManifest(f.options);
  assert.equal(receipt.fileCount, 1);
  assert.equal(receipt.offlineLaunchVerified, false);
  assert.equal(receipt.geodeticAcceptanceVerified, false);
  generateNativeDataManifest(f.options);
  assert.equal(fs.readFileSync(f.manifestPath, 'utf8'), first);
});
test('same-length corruption and missing payload fail', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'nested/terrain.bin'), Buffer.from([4, 3, 2, 1]));
  assert.throws(() => verifyNativeDataManifest(f.options), /SHA-256 mismatch/);
  fs.rmSync(path.join(f.root, 'nested/terrain.bin'));
  assert.throws(() => verifyNativeDataManifest(f.options), /missing/);
});
test('only the exact manifest file is exempt from extra-file rejection', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'nested/data-manifest.json'), '{}');
  assert.throws(() => verifyNativeDataManifest(f.options), /Unmanifested/);
  assert.equal(verifyNativeDataManifest({ ...f.options, rejectExtraFiles: false }).fileCount, 1);
});
test('unsafe and Windows-ambiguous names are rejected on every platform', t => {
  const f = fixture(t);
  for (const value of ['../outside', '/absolute', 'C:/outside', 'nested/../x', 'nested\\x', 'file:stream', 'con', 'LPT1.txt', 'a//b', './x', 'name.', 'name ']) {
    editManifest(f, d => { d.files[0].path = value; });
    assert.throws(() => verifyNativeDataManifest(f.options), /Unsafe/, value);
  }
});
test('duplicates, empty manifests, bad hashes and invalid sizes are rejected', t => {
  const f = fixture(t);
  const original = fs.readFileSync(f.manifestPath);
  for (const mutate of [d => d.files.push(d.files[0]), d => { d.files = []; }, d => { d.files[0].sha256 = 'no'; }, d => { d.files[0].sizeBytes = -1; }]) {
    fs.writeFileSync(f.manifestPath, original); editManifest(f, mutate);
    assert.throws(() => verifyNativeDataManifest(f.options));
  }
});
test('payload symlinks cannot bypass inventory or hashing', t => {
  const f = fixture(t);
  try { fs.symlinkSync(path.join(f.root, 'nested/terrain.bin'), path.join(f.root, 'alias.bin')); }
  catch (e) { if (e.code === 'EPERM') return t.skip('Host disallows unprivileged symlinks'); throw e; }
  assert.throws(() => verifyNativeDataManifest(f.options), /symlink/);
});
test('successful staging verifies copied bytes and replaces the old snapshot', t => {
  const f = fixture(t);
  const destinationRoot = path.join(f.temp, 'staged');
  fs.mkdirSync(destinationRoot); fs.writeFileSync(path.join(destinationRoot, 'old.txt'), 'previous');
  const receipt = stageNativeData({ sourceRoot: f.root, destinationRoot });
  assert.equal(receipt.status, 'STAGED_SNAPSHOT_BYTES_VERIFIED');
  assert.equal(receipt.manifestSha256, verifyNativeDataManifest({ dataRoot: destinationRoot }).manifestSha256);
  assert.ok(!fs.existsSync(path.join(destinationRoot, 'old.txt')));
});
test('failed validation preserves the previous staged snapshot', t => {
  const f = fixture(t);
  const destinationRoot = path.join(f.temp, 'staged');
  fs.mkdirSync(destinationRoot); fs.writeFileSync(path.join(destinationRoot, 'old.txt'), 'previous');
  fs.writeFileSync(path.join(f.root, 'nested/terrain.bin'), 'corrupt');
  assert.throws(() => stageNativeData({ sourceRoot: f.root, destinationRoot }), /mismatch/);
  assert.equal(fs.readFileSync(path.join(destinationRoot, 'old.txt'), 'utf8'), 'previous');
});
test('failed copying preserves the old stage and cleans temporary files', t => {
  const f = fixture(t);
  const destinationRoot = path.join(f.temp, 'staged');
  fs.mkdirSync(destinationRoot); fs.writeFileSync(path.join(destinationRoot, 'old.txt'), 'previous');
  const original = fs.copyFileSync;
  fs.copyFileSync = () => { throw new Error('simulated disk failure'); };
  try { assert.throws(() => stageNativeData({ sourceRoot: f.root, destinationRoot }), /disk failure/); }
  finally { fs.copyFileSync = original; }
  assert.equal(fs.readFileSync(path.join(destinationRoot, 'old.txt'), 'utf8'), 'previous');
  assert.deepEqual(fs.readdirSync(f.temp).sort(), ['source', 'staged']);
});
test('same, nested and ancestor staging destinations are rejected before mutation', t => {
  const f = fixture(t);
  for (const destinationRoot of [f.root, path.join(f.root, 'inside'), f.temp]) assert.throws(() => stageNativeData({ sourceRoot: f.root, destinationRoot }), /overlap/);
  assert.equal(verifyNativeDataManifest(f.options).fileCount, 1);
});
test('shell verifier uses the same strict integrity rules', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t);
  const script = path.join(import.meta.dirname, 'Verify-NativeDataManifest.sh');
  assert.match(execFileSync('bash', [script, f.root, f.manifestPath, 'true'], { encoding: 'utf8' }), /SNAPSHOT_BYTES_VERIFIED/);
});

test('corruption introduced during copying is rejected before replacement', t => {
  const f = fixture(t);
  const destinationRoot = path.join(f.temp, 'staged');
  fs.mkdirSync(destinationRoot); fs.writeFileSync(path.join(destinationRoot, 'old.txt'), 'previous');
  const original = fs.copyFileSync;
  fs.copyFileSync = (from, to) => { original(from, to); if (to.endsWith('terrain.bin')) fs.writeFileSync(to, Buffer.from([4,3,2,1])); };
  try { assert.throws(() => stageNativeData({ sourceRoot: f.root, destinationRoot }), /SHA-256 mismatch/); }
  finally { fs.copyFileSync = original; }
  assert.equal(fs.readFileSync(path.join(destinationRoot, 'old.txt'), 'utf8'), 'previous');
});
test('case aliases are rejected when the host can represent both', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'nested', 'TERRAIN.bin'), 'alias');
  if (fs.readdirSync(path.join(f.root, 'nested')).length < 2) return t.skip('Case insensitive filesystem');
  assert.throws(() => verifyNativeDataManifest(f.options), /Case-colliding/);
});
