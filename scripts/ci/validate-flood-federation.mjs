#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const required = [
  'data/schemas/tsm-flood-information-federation-v1.schema.json',
  'tsm-console/server/ingestion/flood-information-federation.mjs',
  'tsm-console/tests/flood-information-federation.test.mjs',
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length) {
  console.error(JSON.stringify({ ok: false, gate: 'flood-information-federation', missing }, null, 2));
  process.exit(1);
}

const schema = JSON.parse(fs.readFileSync(path.join(root, required[0]), 'utf8'));
for (const key of [
  'source_authority',
  'regulatory_status',
  'retrieved_at',
  'horizontal_crs',
  'vertical_datum',
  'model_lineage',
  'software_version',
  'uncertainty',
]) {
  if (!schema.required.includes(key)) {
    console.error(JSON.stringify({ ok: false, gate: 'flood-information-federation', error: `schema missing mandatory field ${key}` }, null, 2));
    process.exit(1);
  }
}

const moduleSource = fs.readFileSync(path.join(root, required[1]), 'utf8');
for (const token of [
  'validateFloodInformationResult',
  'insurance_determination_eligible',
  'IDNR_BEST_AVAILABLE',
  'USGS_INUNDATION',
  'MODEL_OUTPUT',
  'provenance_hash_sha256',
]) {
  if (!moduleSource.includes(token)) {
    console.error(JSON.stringify({ ok: false, gate: 'flood-information-federation', error: `implementation missing ${token}` }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({ ok: true, gate: 'flood-information-federation' }, null, 2));
