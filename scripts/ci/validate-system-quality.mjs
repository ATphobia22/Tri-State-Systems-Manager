#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const path = new URL('data/engineering/system-quality-contract-v1.json', root);
const contract = JSON.parse(await readFile(path, 'utf8'));

if (contract.schema_version !== '1.0.0') throw new Error('system quality contract version mismatch');

const principles = [
  'requirements_traceability',
  'fail_closed',
  'deterministic_reproduction',
  'provenance_preservation',
  'independent_verification',
  'human_authority_boundary',
  'observable_runtime_state',
  'bounded_resources',
];
for (const key of principles) {
  if (contract.principles?.[key] !== true) {
    throw new Error(`system quality principle missing: ${key}`);
  }
}

if (!Array.isArray(contract.service_objectives) || contract.service_objectives.length < 5) {
  throw new Error('system quality contract requires service objectives');
}
for (const objective of contract.service_objectives) {
  if (!objective.id || !objective.indicator || !objective.target) {
    throw new Error('service objective is incomplete');
  }
}

for (const [key, value] of Object.entries(contract.performance_controls ?? {})) {
  if (value !== true) throw new Error(`performance control disabled: ${key}`);
}

if (!Array.isArray(contract.verification_layers) || contract.verification_layers.length < 8) {
  throw new Error('verification layer contract is incomplete');
}

const runtime = contract.runtime_observability;
const requiredRuntimeSignals = ['api', 'upstream', 'ingestion', 'cache', 'browser', 'server', 'engineering'];
for (const key of requiredRuntimeSignals) {
  if (!Array.isArray(runtime?.[key]) || runtime[key].length === 0) throw new Error(`runtime observability signal missing: ${key}`);
}
if (runtime?.measurement_mode !== 'in-process bounded measurements with Prometheus exposition plus browser-side batched telemetry') throw new Error('runtime measurement mode changed');

const risk = contract.risk_controls;
if (risk?.single_source_of_truth !== 'source authority and provenance metadata, never UI state') {
  throw new Error('single-source-of-truth boundary changed');
}
if (risk?.model_output !== 'derived evidence only') throw new Error('model-output authority boundary changed');
if (risk?.regulatory_output !== 'human/agency authority only') throw new Error('regulatory authority boundary changed');
if (risk?.credential_metadata !== 'human capability metadata only') throw new Error('credential authority boundary changed');
if (risk?.external_dependencies !== 'pinned, auditable, fail-closed where required') {
  throw new Error('external dependency boundary changed');
}

console.log('system engineering quality contract passed');
