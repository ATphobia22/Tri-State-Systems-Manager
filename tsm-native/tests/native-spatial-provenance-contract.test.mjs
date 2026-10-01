import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..', '..');
const validator = fs.readFileSync(
  path.join(root, 'tsm-native/Source/TSMNative/TSMSpatialValidator.cpp'),
  'utf8',
);
const downloader = fs.readFileSync(
  path.join(root, 'tsm-native/Source/TSMNative/TSMManifestDownloader.cpp'),
  'utf8',
);
const build = fs.readFileSync(
  path.join(root, 'tsm-native/Source/TSMNative/TSMNative.Build.cs'),
  'utf8',
);

test('native spatial provenance boundary uses repository SHA-256 implementation', () => {
  assert.match(validator, /TsmComputeSha256/);
  assert.match(build, /"TSMCrypto"/);
  assert.match(build, /"Json"/);
});

test('native manifest downloader is HTTPS and Pages-origin restricted', () => {
  assert.match(downloader, /IsSecureProtocol/);
  assert.match(downloader, /atphobia22\.github\.io/);
  assert.match(downloader, /Tri-State-Systems-Manager/);
});

test('native verifier fails closed on missing or mismatched asset hashes', () => {
  assert.match(validator, /return false;/);
  assert.match(validator, /bProvenanceVerified/);
  assert.match(validator, /ExpectedSha256/);
  assert.match(validator, /ComputedSha256/);
});
