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
});


test('server ingestion evidence boundary is fail-closed', async () => {
  const { validateEvidenceArtifact } = await import('../server/ingestion/workers.mjs');
  assert.throws(
    () => validateEvidenceArtifact({ governance_status: 'human_review_required' }),
    /Missing human authorization status/,
  );
  assert.throws(
    () => validateEvidenceArtifact({
      governance_status: 'human_authorized',
      human_review_status: 'signed',
      reviewer_identity: 'reviewer',
      review_reason: 'approved',
      reviewed_at: '2026-09-18T00:00:00Z',
    }),
    /Missing cryptographic provenance/,
  );
  assert.equal(
    validateEvidenceArtifact({
      governance_status: 'human_authorized',
      human_review_status: 'signed',
      reviewer_identity: 'reviewer',
      review_reason: 'approved',
      reviewed_at: '2026-09-18T00:00:00Z',
      source_provenance: { provider: 'USGS' },
      source_hash: 'abc123',
    }),
    true,
  );
});
