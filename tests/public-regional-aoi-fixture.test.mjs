import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const fixtureUrl = new URL('./fixtures/public-regional-aoi.synthetic.geojson', import.meta.url);
const prohibited = /\\b(?:address|parcelId|siteAnchor|owner)\\b/;

test('public regional fixture stays synthetic, coarse, non-regulatory and without residential values', async () => {
  const source = await readFile(fixtureUrl, 'utf8');
  const fc = JSON.parse(source);
  assert.equal(fc.type, 'FeatureCollection');
  assert.equal(fc.metadata.synthetic, true);
  assert.equal(fc.metadata.publicationClass, 'PUBLIC_TEST_FIXTURE');
  assert.equal(fc.metadata.sourceAuthority, 'NONE_SYNTHETIC');
  for (const prop of ['engineeringUse', 'scientificUse', 'regulatoryUse', 'privateEvidenceIncluded']) {
    assert.equal(fc.metadata[prop], false);
  }
  assert.equal(fc.features.length, 1);
  const f = fc.features[0];
  for (const key of ['parcelId', 'address', 'siteAnchor', 'owner']) {
    assert.equal(f.properties[key], null, key + ' must remain unset');
  }
  assert.equal(f.geometry.type, 'Polygon');
  assert.equal(f.geometry.coordinates.length, 1);
  const ring = f.geometry.coordinates[0];
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring.at(-1));
  const lng = ring.map(x => x[0]), lat = ring.map(x => x[1]);
  for (const [x, y] of ring) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    // Deliberate half-degree or whole-degree coordinates: no site precision.
    assert.equal(x * 2, Math.round(x * 2));
    assert.equal(y * 2, Math.round(y * 2));
  }
  assert.ok(Math.max(...lng) - Math.min(...lng) >= 1);
  assert.ok(Math.max(...lat) - Math.min(...lat) >= 1);
  assert.doesNotMatch(source, /\\b\\d{1,6}\\s+[A-Za-z]{3,}\\s+(?:Road|Street|Avenue|Drive|Lane)\\b/i);
  assert.equal(f.properties.noRegulatoryDetermination, true);
});

// The repository's existing owner-directed disclosure remains a separate
// authorization question. A safe *synthetic fixture* does not certify
// other repository assets, historical commits, Pages or private AOIs.
test('synthetic AOI is never implicitly converted to verified engineering evidence', async () => {
  const fc = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  assert.equal(fc.metadata.verticalDatum, 'NOT_APPLICABLE');
  assert.equal(fc.metadata.geometryPurpose, 'REGRESSION_TEST_ONLY');
  assert.notEqual(fc.features[0].properties.source, 'FEMA');
  assert.notEqual(fc.features[0].properties.source, 'USGS');
});
