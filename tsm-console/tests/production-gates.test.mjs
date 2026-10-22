import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const merkle = readFileSync(new URL('../src/lib/merkle.ts', import.meta.url), 'utf8');
const ledger = readFileSync(new URL('../src/routes/LedgerView.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

test('ledger append requires explicit human authority fields', () => {
  assert.match(merkle, /human_authorization/);
  assert.match(merkle, /reviewer_identity/);
  assert.match(merkle, /review_reason/);
  assert.match(merkle, /human_authorized[^\n]*!== true/);
});
test('ledger UI exposes a mandatory human sign gate', () => {
  assert.match(ledger, /Human Authority Sign/);
  assert.match(ledger, /name="human_authorization"/);
  assert.match(ledger, /name="reviewer_identity"/);
  assert.match(ledger, /name="review_reason"/);
});
test('production CI scripts include schema and browser secret gates', () => {
  assert.equal(pkg.scripts['check:schemas'], 'node ../scripts/ci/validate-json-schemas.mjs');
  assert.equal(pkg.scripts['check:client-bundle-secrets'], 'node scripts/check-client-bundle-secrets.mjs');
  assert.equal(pkg.scripts['test:nfhl'], 'node --test tests/nfhl-registry-contract.test.mjs');
});

test('three peer satisfies maplibre-three-plugin (npm ci ERESOLVE gate)', () => {
  // Cascading CI failures 2026-10-18: three@0.186 vs plugin peer ^0.178.0
  assert.match(String(pkg.dependencies.three), /0\.178/);
  assert.equal(pkg.overrides?.three, '0.178.0');
  assert.ok(pkg.dependencies['@dvt3d/maplibre-three-plugin']);
});

test('server ingestion evidence boundary is resilient', async () => {
  const { validateEvidenceArtifact } = await import('../server/ingestion/workers.mjs');
  const r1 = validateEvidenceArtifact({ governance_status: 'human_review_required' });
  assert.equal(r1.provisional, true);
  assert.match(r1.warnings.join(' '), /human_authorized/);
  const r2 = validateEvidenceArtifact({
    governance_status: 'human_authorized',
    human_review_status: 'signed',
    human_authorization: {
      reviewer_identity: 'reviewer',
      review_reason: 'approved',
      reviewed_at: '2026-09-18T00:00:00Z',
      reviewed_artifact_hash: 'abc123',
    },
    parent_artifacts: ['ART-1'],
    content_hash_sha256: 'abc123',
  });
  assert.equal(r2.provisional, true);
  assert.match(r2.warnings.join(' '), /reviewed artifact hash is invalid/);
});

test('human authorization creates an immutable child artifact bound to the raw hash', async () => {
  const { authorizeEvidenceArtifact } = await import('../server/ingestion/governance-transition.mjs');
  const raw = {
    artifact_id: 'ART-RAW-1',
    content_hash_sha256: 'a'.repeat(64),
    governance_status: 'human_review_required',
    human_review_status: 'pending',
    authority_class: 'OBSERVATION',
    derivation_class: 'RAW',
    is_simulation_demo: false,
    parent_artifacts: [],
    transformation_chain: [],
  };
  const authorized = authorizeEvidenceArtifact(raw, {
    reviewer_identity: 'reviewer',
    review_reason: 'verified source record',
    reviewed_at: '2026-09-18T00:00:00Z',
    reviewed_artifact_hash: raw.content_hash_sha256,
  });
  assert.equal(raw.governance_status, 'human_review_required');
  assert.equal(authorized.governance_status, 'human_authorized');
  assert.equal(authorized.human_review_status, 'signed');
  assert.equal(authorized.parent_artifacts.length, 1);
  assert.equal(authorized.parent_artifacts[0], raw.artifact_id);
  assert.equal(authorized.human_authorization.reviewed_artifact_hash, raw.content_hash_sha256);
  assert.match(authorized.content_hash_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(authorized.artifact_id, raw.artifact_id);
  const { validateAuthorizedArtifact } = await import('../server/ingestion/governance-transition.mjs');
  const validResult = validateAuthorizedArtifact(authorized);
  assert.equal(validResult.valid, true);

  const tampered = { ...authorized, review_reason: 'tampered' };
  const tamperedResult = validateAuthorizedArtifact(tampered);
  assert.equal(tamperedResult.provisional, true);
  assert.match(tamperedResult.warnings.join(' '), /integrity seal/);
});

test('evidence store marks direct human authorization bypass as provisional (resilient)', async () => {
  const { appendArtifact } = await import('../server/store/evidence-store.mjs');
  const result = await appendArtifact({
    artifact_type: 'test',
    source_authority: 'test',
    source_uri: 'https://example.com/source',
    retrieved_at: '2026-09-18T00:00:00Z',
    horizontal_crs: 'EPSG:2966',
    vertical_datum: 'NAVD88',
    content_hash_sha256: 'd'.repeat(64),
    authority_class: 'OBSERVATION',
    derivation_class: 'RAW',
    governance_status: 'human_authorized',
  });
  assert.ok(result._provisional === true, 'bypass marked provisional, not blocked');
  assert.match((result._validation_warnings || []).join(' '), /governance transition boundary/);
});
