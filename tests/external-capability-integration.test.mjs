import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile('integrations/registry/capabilities.json', 'utf8'));
const threeDContract = JSON.parse(await readFile('integrations/geospatial/3d-asset-contract.schema.json', 'utf8'));
const cityEngineContract = JSON.parse(await readFile('integrations/cityengine/asset-manifest.schema.json', 'utf8'));
const quantumContract = JSON.parse(await readFile('integrations/quantum/optimization-contract.schema.json', 'utf8'));

test('registry contains exactly the seven approved capability sources', () => {
  assert.equal(registry.capabilities.length, 7);
  assert.deepEqual(
    registry.capabilities.map((entry) => entry.source).sort(),
    [
      '3d-geospatial/3d-geospatial.com',
      'Esri/cityengine-sdk',
      'Esri/cityengine_for_unreal',
      'HariSekhon/DevOps-Bash-tools',
      'jonashackt/gitlab-ci-stack',
      'marcelbirkner/docker-ci-tool-stack',
      'quantumlib/OpenFermion-Cirq',
    ],
  );
});

test('all capability references are immutable commit SHAs', () => {
  for (const entry of registry.capabilities) assert.match(entry.ref, /^[0-9a-f]{40}$/);
});

test('quantum capability is non-authoritative and archived', () => {
  const entry = registry.capabilities.find((item) => item.id === 'openfermion-cirq');
  assert.equal(entry.upstream_status, 'deprecated-and-archived');
  assert.ok(entry.forbidden_use.includes('authoritative-state-mutation'));
  assert.ok(entry.forbidden_use.includes('production-regulatory-decision'));
});

test('3D and CityEngine contracts require geodetic metadata and digests', () => {
  assert.ok(threeDContract.required.includes('source_crs'));
  assert.ok(threeDContract.required.includes('target_crs'));
  assert.ok(threeDContract.required.includes('vertical_datum'));
  assert.ok(threeDContract.required.includes('sha256'));
  assert.ok(cityEngineContract.required.includes('crs'));
  assert.ok(cityEngineContract.required.includes('vertical_datum'));
  assert.ok(cityEngineContract.required.includes('sha256'));
});

test('quantum contract hard-codes research-only output and no authoritative mutation', () => {
  assert.equal(quantumContract.properties.output_classification.const, 'research-only');
  assert.equal(quantumContract.properties.authoritative_mutation.const, false);
});
