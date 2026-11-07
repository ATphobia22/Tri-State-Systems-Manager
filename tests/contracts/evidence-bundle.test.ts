import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateEvidenceBundle,
} from '../../packages/contracts/src/EvidenceBundle.ts';
import type { EvidenceBundle } from '../../packages/contracts/src/EvidenceBundle.ts';

const HASH = `sha256:${'a'.repeat(64)}`;
const OTHER_HASH = `sha256:${'b'.repeat(64)}`;

function validBundle(): EvidenceBundle {
  return {
    bundleId: 'bundle-001',
    artifactId: 'artifact-001',
    inputHash: HASH,
    outputHash: OTHER_HASH,
    metadataHash: HASH,
    provenanceHash: HASH,
    createdAt: '2026-11-07T14:00:00Z',
  };
}

test('valid bundle with output hash passes', () => {
  const result = validateEvidenceBundle(validBundle());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('valid bundle without output hash passes (ingest-time seal)', () => {
  const bundle = validBundle();
  const { outputHash: _dropped, ...withoutOutput } = bundle;
  assert.equal(validateEvidenceBundle(withoutOutput).valid, true);
});

test('missing bundle id and artifact id are reported', () => {
  const bundle = { ...validBundle(), bundleId: '  ', artifactId: '' };
  const result = validateEvidenceBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('MISSING_BUNDLE_ID'));
  assert.ok(result.errors.includes('MISSING_ARTIFACT_ID'));
});

test('bare hex hash without the sha256: prefix is rejected', () => {
  const bundle = { ...validBundle(), inputHash: 'a'.repeat(64) };
  const result = validateEvidenceBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('INVALID_INPUT_HASH'));
});

test('uppercase hex hash is rejected', () => {
  const bundle = { ...validBundle(), metadataHash: `sha256:${'A'.repeat(64)}` };
  const result = validateEvidenceBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('INVALID_METADATA_HASH'));
});

test('malformed optional output hash is rejected', () => {
  const bundle = { ...validBundle(), outputHash: 'not-a-hash' };
  const result = validateEvidenceBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('INVALID_OUTPUT_HASH'));
});

test('invalid createdAt is rejected', () => {
  const bundle = { ...validBundle(), createdAt: 'yesterday' };
  const result = validateEvidenceBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('INVALID_CREATED_AT'));
});

test('non-object input returns an error instead of throwing', () => {
  for (const bad of [null, undefined, 'bundle', 42, []]) {
    const result = validateEvidenceBundle(bad);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('EVIDENCE_BUNDLE_MUST_BE_AN_OBJECT'));
  }
});
