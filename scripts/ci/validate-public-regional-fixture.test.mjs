import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePublicRegionalFixture } from './validate-public-regional-fixture.mjs';

const fixture = JSON.parse(readFileSync('data/fixtures/public-regional-aoi.synthetic.geojson', 'utf8'));
const copy = () => structuredClone(fixture);

test('public demo fixture is purely synthetic, regional and structurally valid', () => {
  assert.deepEqual(validatePublicRegionalFixture(fixture), []);
});
test('reject property-level identifiers even when syntactically valid', () => {
  const sample = copy();
  sample.features[0].properties.parcelId = 'DEMO-DO-NOT-PUBLISH';
  assert.ok(validatePublicRegionalFixture(sample).length > 0);
});
test('reject precise household-sized polygon', () => {
  const sample = copy();
  sample.features[0].geometry.coordinates = [[[0,0],[0.001,0],[0.001,0.001],[0,0.001],[0,0]]];
  assert.ok(validatePublicRegionalFixture(sample).some(x => x.includes('too narrow')));
});
test('reject promotion to engineering authority', () => {
  const sample = copy();
  sample.metadata.engineeringUse = true;
  assert.ok(validatePublicRegionalFixture(sample).length > 0);
});
test('reject broken coordinates and open rings', () => {
  const sample = copy();
  sample.features[0].geometry.coordinates[0][2] = [Number.NaN, 39];
  assert.ok(validatePublicRegionalFixture(sample).includes('Invalid coordinates'));
  const unclosed = copy();
  unclosed.features[0].geometry.coordinates[0][4] = [-88,38];
  assert.ok(validatePublicRegionalFixture(unclosed).includes('Unclosed region ring'));
});
