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
  assert.equal(m.screeningGeojson, 'buildings-3d.json');
  assert.equal(m.geojsonCountIsNotMeshCount, true);
  assert.equal(m.meshCoverageIndependentlyAccepted, false);
});

// OGC 22-025r4: bounding region longitude/latitude are radians, NOT degrees.
// GeoJSON is a screening layer and must not be disguised as renderable 3D tile content.
test('public OGC 3D Tiles root uses radian bounds and a real nested mesh tileset', async () => {
  const root = JSON.parse(await readFile(
    new URL('../public/3d-tiles/tileset.json', import.meta.url), 'utf8',
  ));
  assert.equal(root.asset.version, '1.1');
  const [west, south, east, north, low, high] = root.root.boundingVolume.region;
  assert.ok([west, south, east, north, low, high].every(Number.isFinite));
  assert.ok(west >= -Math.PI && east <= Math.PI && west < east);
  assert.ok(south >= -Math.PI / 2 && north <= Math.PI / 2 && south < north);
  // The bounds must locate Posey County, not merely fall within generic radian ranges.
  assert.ok(west < -1.5 && east > -1.55 && south > 0.6 && north < 0.7);
  assert.ok(low <= high);
  const uri = root.root.content.uri;
  assert.equal(uri, root.asset.extras.tsm.renderableMeshTileset);
  assert.match(uri, /^buildings-lidar-12450\\/tileset\\.json$/);
  assert.doesNotMatch(uri, /buildings-3d\\.json|\\.geojson$/i);
  const nested = JSON.parse(await readFile(
    new URL('../public/3d-tiles/' + uri, import.meta.url), 'utf8',
  ));
  assert.equal(nested.asset.version, '1.1');
  assert.equal(nested.root.implicitTiling.subdivisionScheme, 'QUADTREE');
  assert.match(nested.root.content.uri, /\\.glb$/);
  assert.deepEqual(root.root.boundingVolume.region, nested.root.boundingVolume.region);
  assert.ok(root.root.geometricError >= nested.root.geometricError);
  assert.equal(root.asset.extras.tsm.engineeringUse, false);
  assert.equal(root.asset.extras.tsm.regulatoryUse, false);
});
