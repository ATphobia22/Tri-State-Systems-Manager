#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const REGISTRY_PATH = resolve(ROOT, 'integrations/registry/capabilities.json');

const EXPECTED_SOURCES = new Set([
  'jonashackt/gitlab-ci-stack',
  'marcelbirkner/docker-ci-tool-stack',
  'HariSekhon/DevOps-Bash-tools',
  'Esri/cityengine_for_unreal',
  'Esri/cityengine-sdk',
  '3d-geospatial/3d-geospatial.com',
  'quantumlib/OpenFermion-Cirq',
]);

function fail(message) {
  console.error(`CAPABILITY REGISTRY ERROR: ${message}`);
  process.exitCode = 1;
}

const raw = await readFile(REGISTRY_PATH, 'utf8');
const registry = JSON.parse(raw);
const errors = [];

if (registry.schema_version !== '1.0.0') errors.push('unsupported schema_version');
if (registry.canonical_repository !== 'ATphobia22/Tri-State-Systems-Manager') errors.push('canonical repository mismatch');
if (!Array.isArray(registry.capabilities) || registry.capabilities.length !== EXPECTED_SOURCES.size) {
  errors.push(`expected exactly ${EXPECTED_SOURCES.size} capabilities`);
}

const seen = new Set();
for (const capability of registry.capabilities ?? []) {
  const required = ['id', 'source', 'url', 'ref_type', 'ref', 'role', 'classification', 'allowed_use', 'forbidden_use', 'license_policy', 'runtime_boundary', 'security'];
  for (const key of required) {
    if (!(key in capability)) errors.push(`${capability.id ?? '<unknown>'}: missing ${key}`);
  }
  if (seen.has(capability.id)) errors.push(`duplicate id: ${capability.id}`);
  seen.add(capability.id);
  if (!EXPECTED_SOURCES.has(capability.source)) errors.push(`unexpected source: ${capability.source}`);
  if (capability.ref_type !== 'commit' || !/^[0-9a-f]{40}$/.test(capability.ref ?? '')) {
    errors.push(`${capability.id}: ref must be a 40-character immutable commit SHA`);
  }
  if (!/^https:\/\/github\.com\//.test(capability.url ?? '')) errors.push(`${capability.id}: non-GitHub HTTPS URL`);
  if (!Array.isArray(capability.allowed_use) || capability.allowed_use.length === 0) errors.push(`${capability.id}: allowed_use must be non-empty`);
  if (!Array.isArray(capability.forbidden_use) || capability.forbidden_use.length === 0) errors.push(`${capability.id}: forbidden_use must be non-empty`);
  if (capability.source === 'quantumlib/OpenFermion-Cirq' && capability.classification !== 'deprecated-research') errors.push('OpenFermion-Cirq must remain deprecated-research');
  if (capability.source.startsWith('Esri/') && !capability.license_policy.includes('Esri')) errors.push(`${capability.id}: Esri licensing boundary missing`);
}

for (const source of EXPECTED_SOURCES) if (![...seen].some((id) => (registry.capabilities ?? []).find((c) => c.id === id)?.source === source)) errors.push(`missing source: ${source}`);

if (errors.length) {
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Capability registry valid: ${registry.capabilities.length} immutable capability sources.`);
