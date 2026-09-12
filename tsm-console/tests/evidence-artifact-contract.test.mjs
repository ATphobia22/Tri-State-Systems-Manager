import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const store = readFileSync(new URL('../server/store/evidence-store.mjs', import.meta.url), 'utf8');
const schema = JSON.parse(readFileSync(new URL('../../data/schemas/hec-ras-2d-evidence-artifact.schema.json', import.meta.url)));

test('EvidenceArtifact uses deterministic lowercase SHA-256 content hashes', () => {
  assert.match(store, /createHash\('sha256'\)/);
  assert.match(store, /\^\[a-f0-9\]\{64\}\$/);
  assert.equal(schema.properties.content_hash_sha256.pattern, '^[a-f0-9]{64}$');
});

test('HEC-RAS evidence cannot self-promote to regulatory authority', () => {
  assert.deepEqual(schema.properties.authority_class.enum, ['SIMULATION_DEMO', 'MODEL_OUTPUT']);
  assert.equal(schema.properties.governance_status.const, 'human_review_required');
  assert.equal(schema.properties.is_simulation_demo.const, true);
});

test('EvidenceArtifact requires transformation and review provenance', () => {
  for (const field of ['source_uri', 'retrieved_at', 'content_hash_sha256', 'horizontal_crs', 'vertical_datum', 'transformation_chain', 'validation_status', 'human_review_status']) {
    assert.ok(schema.required.includes(field), `missing evidence field ${field}`);
  }
});
