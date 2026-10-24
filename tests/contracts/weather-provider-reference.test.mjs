import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('../../integrations/weather-provider-reference.json', import.meta.url), 'utf8'));
const waypointSchema = JSON.parse(readFileSync(new URL('../../schemas/compass-waypoint.schema.json', import.meta.url), 'utf8'));

test('Apple Weather reference registry has 19 unique provider IDs', () => {
  assert.equal(registry.appleWeatherProviders.length, 19);
  const ids = registry.appleWeatherProviders.map((provider) => provider.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(registry.appleWeatherProviders.every((provider) => provider.appleListed === true));
});

test('registry does not assert direct access without verification', () => {
  assert.ok(registry.appleWeatherProviders.every((provider) => provider.directAccessStatus === 'unverified'));
  assert.equal(registry.optionalIntegrations.find((item) => item.id === 'apple-weatherkit')?.status, 'optional-candidate');
  assert.ok(registry.integrationRules.some((rule) => rule.includes('do not infer')));
});

test('waypoint schema requires CRS, source, timestamp, and review status', () => {
  assert.equal(waypointSchema.type, 'object');
  for (const field of ['id', 'label', 'coordinates', 'coordinateReferenceSystem', 'source', 'recordedAt', 'reviewStatus']) {
    assert.ok(waypointSchema.required.includes(field), `missing required field: ${field}`);
  }
  assert.equal(waypointSchema.properties.engineeringUse.const, 'not-authorized');
  assert.equal(waypointSchema.properties.coordinates.properties.latitude.minimum, -90);
  assert.equal(waypointSchema.properties.coordinates.properties.longitude.maximum, 180);
});
