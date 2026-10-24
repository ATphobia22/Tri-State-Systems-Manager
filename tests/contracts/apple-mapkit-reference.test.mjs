import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('schemas/apple-place-reference.schema.json', root), 'utf8'));
const research = readFileSync(new URL('docs/research/WWDC24-MAPKIT-AND-MAPS-LOCATION.md', root), 'utf8');

test('Apple Place IDs remain optional display references, not engineering authority', () => {
  assert.equal(schema.properties.provider.const, 'apple-mapkit');
  assert.equal(schema.properties.useBoundary.const, 'discovery-display-only');
  assert.equal(schema.properties.engineeringAuthority.const, 'not-authoritative');
  assert.equal(schema.properties.coordinateEvidence.const, 'must-be-sourced-separately');
  assert.ok(schema.required.includes('placeId'));
  assert.ok(schema.required.includes('retrievedAt'));
  assert.ok(!schema.required.includes('coordinate'));
  assert.ok(!schema.required.includes('parcelId'));
});

test('MapKit research distinguishes official session content from forum reports', () => {
  assert.match(research, /Unlock the power of places with MapKit/);
  assert.match(research, /user reports and questions, not official statements/i);
  assert.match(research, /No Apple Maps\/MapKit API is called by TSM/i);
  assert.match(research, /coordinate provenance/i);
});
