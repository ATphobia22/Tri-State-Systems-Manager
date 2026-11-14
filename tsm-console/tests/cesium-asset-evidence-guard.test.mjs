import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseCesiumAsset } from '../src/lib/cesium-asset-evidence-guard.ts';
const sha = 'a'.repeat(64);
const local = { relativePath: '3d-tiles/posey/tileset.json', sha256: sha, manifestVerified: true, licenseReviewed: true };
const ion = { assetId: 6155963, status: 'COMPLETE', sourceSha256: sha, tilingCompletedAt: '2026-11-14T10:00:00Z', licenseReviewed: true, sourceDatumReviewed: true };
test('offline never falls back to ion', () => {
  assert.equal(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: false, ionTokenConfigured: true }).source, 'SOURCE_UNAVAILABLE');
  assert.deepEqual(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: false, ionTokenConfigured: true, localReceipt: local }), { source: 'OFFLINE_LOCAL', url: local.relativePath, sha256: sha });
});
test('an ion ID or bare COMPLETE is not upload/tiling evidence', () => {
  assert.deepEqual(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: true, ionTokenConfigured: true }), { source: 'ION', assetId: 96188 });
  assert.equal(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: true, ionTokenConfigured: true, ionReceipt: { ...ion, sourceSha256: '' } }).assetId, 96188);
  assert.equal(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: true, ionTokenConfigured: true, ionReceipt: ion }).assetId, 6155963);
});
test('invalid, unreviewed or traversal local sources are blocked', () => {
  for (const relativePath of ['../tileset.json', '/tileset.json', 'https://host/tileset.json', 'tiles/../../tileset.json', 'tiles//tileset.json']) {
    assert.equal(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: false, ionTokenConfigured: false, localReceipt: { ...local, relativePath } }).source, 'SOURCE_UNAVAILABLE');
  }
  assert.equal(chooseCesiumAsset('poseyLod2Buildings', { networkAllowed: false, ionTokenConfigured: false, localReceipt: { ...local, licenseReviewed: false } }).source, 'SOURCE_UNAVAILABLE');
});
