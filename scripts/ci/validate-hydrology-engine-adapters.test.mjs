import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateHydrologyAdapters } from './validate-hydrology-engine-adapters.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const registry = JSON.parse(readFileSync(join(root, 'integrations/hydrology-engine-adapters.json'), 'utf8'));

test('hydrology engine adapter catalog validates and remains credential-free and disabled by default', () => {
  assert.deepEqual(validateHydrologyAdapters(registry), []);
  assert.equal(registry.policy.executionEnabledByDefault, false);
  assert.equal(registry.policy.runtimeCredentialsRequired, false);
  assert.ok(registry.adapters.every(adapter => adapter.runtimeCredentialsRequired === false));
});

test('duplicate adapter identifiers are rejected', () => {
  const invalid = structuredClone(registry);
  invalid.adapters.push(structuredClone(invalid.adapters[0]));
  assert.ok(validateHydrologyAdapters(invalid).some(error => error.includes('duplicate adapter id')));
});

test('missing scientific evidence requirements are rejected', () => {
  const invalid = structuredClone(registry);
  invalid.requiredRunEvidence = ['engine_id'];
  assert.ok(validateHydrologyAdapters(invalid).some(error => error.includes('requiredRunEvidence')));
});

test('solver execution cannot be enabled by default', () => {
  const invalid = structuredClone(registry);
  invalid.policy.executionEnabledByDefault = true;
  assert.ok(validateHydrologyAdapters(invalid).some(error => error.includes('executionEnabledByDefault')));
});

test('HEC-RAS cannot be represented as an open-source solver adapter', () => {
  const invalid = structuredClone(registry);
  invalid.adapters.find(adapter => adapter.id === 'hec-ras').status = 'catalog-only';
  assert.ok(validateHydrologyAdapters(invalid).some(error => error.includes('HEC-RAS')));
});
