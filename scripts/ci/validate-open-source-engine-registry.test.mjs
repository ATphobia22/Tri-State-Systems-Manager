import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { validateRegistry } from './validate-open-source-engine-registry.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const registry = JSON.parse(readFileSync(join(root, 'integrations/open-source-engine-registry.json'), 'utf8'));

test('open-source engine registry passes the credential-free integration contract', () => {
  assert.deepEqual(validateRegistry(registry), []);
  assert.ok(registry.engines.length >= 20);
  assert.ok(registry.engines.every((engine) => engine.runtimeCredentialsRequired === false));
});

test('duplicate engine IDs are rejected', () => {
  const duplicate = structuredClone(registry);
  duplicate.engines.push(structuredClone(duplicate.engines[0]));
  assert.ok(validateRegistry(duplicate).some((error) => error.includes('duplicate engine id')));
});

test('hosted Cesium ion is not included in the credential-free catalog', () => {
  const invalid = structuredClone(registry);
  invalid.engines.push({
    ...invalid.engines[0],
    id: 'cesium-ion',
    project: 'Cesium ion',
    sourceUrl: 'https://ion.cesium.com/',
    openSource: false,
    integrationClass: 'optional',
    status: 'candidate',
    license: 'Hosted service',
    role: 'Hosted story service',
    authorityBoundary: 'Never treat hosted visual content as evidence.',
  });
  assert.ok(validateRegistry(invalid).some((error) => error.includes('Cesium ion')));
});

test('HEC-RAS must remain clearly classified as external non-open-source software', () => {
  const invalid = structuredClone(registry);
  invalid.engines.find((engine) => engine.id === 'hec-ras').openSource = true;
  assert.ok(validateRegistry(invalid).some((error) => error.includes('HEC-RAS')));
});
