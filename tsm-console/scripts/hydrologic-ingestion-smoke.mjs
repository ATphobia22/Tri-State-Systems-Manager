#!/usr/bin/env node
/**
 * Deterministic hydrologic ingestion wiring smoke test.
 * This verifies the ingestion worker module, authority registry, and fail-closed
 * exports without performing network I/O or mutating live evidence state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root, '..', 'tsm-authority-registry-v35.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

if (!Array.isArray(registry.hydrologic_nodes) || registry.hydrologic_nodes.length < 1) {
  throw new Error('hydrologic authority registry is missing hydrologic_nodes');
}

const workers = await import(path.join(root, 'server', 'ingestion', 'workers.mjs'));
for (const name of ['ingestUsgsNode', 'ingestNwpsGauge', 'runHydrologicBatch', 'validateEvidenceArtifact']) {
  if (typeof workers[name] !== 'function') throw new Error(`ingestion worker export missing: ${name}`);
}

const unknownUsgs = await workers.ingestUsgsNode('__TSM_INVALID_STATION__');
if (unknownUsgs.ok !== false || unknownUsgs.code !== 'FAIL_CLOSED') {
  throw new Error('unknown USGS station did not fail closed');
}

const invalidNws = await workers.ingestNwpsGauge('__TSM_INVALID_NWS__');
if (invalidNws.ok !== false || invalidNws.code !== 'FAIL_CLOSED') {
  throw new Error('unknown NOAA station did not fail closed');
}

console.log(JSON.stringify({
  ok: true,
  mode: 'deterministic-wiring-smoke',
  networkCalls: 0,
  hydrologicNodeCount: registry.hydrologic_nodes.length,
  failClosedChecks: 2,
}, null, 2));
