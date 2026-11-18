import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(relative) {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
}

test('the long-lived 3D Tiles registry cannot overstate the published Posey building census', () => {
  const registry = read('../artifacts/tsm-3d-tiles-fabric-v1.json');
  const root = read('../tsm-console/public/3d-tiles/tileset.json');
  const missing = read('../tsm-console/public/3d-tiles/posey-missing-objectids.json');
  const current = root.asset.extras.tsm;
  const tile = registry.registeredTilesets.find((x) => x.id === 'posey-buildings-3dtiles');
  assert.ok(tile, 'Building tiles must remain registered');
  assert.equal(tile.uri, '3d-tiles/tileset.json');
  assert.equal(tile.renderableMeshTileset, '3d-tiles/' + current.renderableMeshTileset);
  assert.equal(tile.status, 'PARTIAL_SOURCE_UNVERIFIED');
  assert.equal(tile.publishedScreeningFeatureCount, current.publishedFeatureCount);
  assert.equal(tile.sourceInventoryTargetCount, current.expectedAuthoritativeFeatureCount);
  assert.equal(tile.unresolvedSourceIdCount, missing.missingCount);
  assert.equal(tile.sourceInventoryTargetCount - tile.publishedScreeningFeatureCount, 267);
  assert.equal(tile.unresolvedSourceIdCount, current.expectedAuthoritativeFeatureCount - current.publishedFeatureCount);
  assert.equal(tile.sourceInventoryVerified, false);
  assert.equal(tile.sourceIdsReconciled, false);
  assert.equal(tile.meshCoverageIndependentlyAccepted, false);
  assert.equal(tile.geojsonCountIsNotMeshCount, true);
  assert.equal(tile.glbCount, null, 'Never conflate legacy unverified GLB counts with published mesh coverage');
  assert.equal(tile.tilesetSha256, null, 'Do not assert a historical hash as current when not freshly checked');
  assert.equal(tile.previousReportedGlbCountStatus, 'LEGACY_UNVERIFIED_DO_NOT_USE_AS_PUBLISHED');
  assert.equal(tile.regulatoryUse, undefined);
  assert.equal(current.engineeringUse, false);
  assert.equal(current.regulatoryUse, false);
});

test('the referenced renderable OGC tileset exists and is not the screening GeoJSON', () => {
  const registry = read('../artifacts/tsm-3d-tiles-fabric-v1.json');
  const item = registry.registeredTilesets.find((x) => x.id === 'posey-buildings-3dtiles');
  const nested = read('../tsm-console/public/' + item.renderableMeshTileset);
  assert.equal(nested.asset.version, '1.1');
  assert.match(nested.root.content.uri, /\.glb$/);
  assert.equal(nested.root.implicitTiling.subdivisionScheme, 'QUADTREE');
  assert.notEqual(item.uri, '3d-tiles/buildings-3d.json');
});
