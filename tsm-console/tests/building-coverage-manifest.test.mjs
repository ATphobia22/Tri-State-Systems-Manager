import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('public Posey building tiles declare partial source coverage, not engineering acceptance', async () => {
  const manifest = JSON.parse(await readFile(
    new URL('../public/3d-tiles/tileset.json', import.meta.url), 'utf8',
  ));
  const m = manifest.asset.extras.tsm;
  assert.equal(m.authorityClass, 'DERIVED');
  assert.equal(m.engineeringUse, false);
  assert.equal(m.regulatoryUse, false);
  assert.equal(m.publishedFeatureCount, 22815);
  assert.equal(m.expectedAuthoritativeFeatureCount, 23082);
  assert.equal(m.expectedAuthoritativeFeatureCount - m.publishedFeatureCount, 267);
  assert.equal(m.sourceIdsReconciled, false);
  assert.equal(m.sourceInventoryVerified, false);
  assert.equal(m.completenessStatus, 'PARTIAL_SOURCE_UNVERIFIED');
});
