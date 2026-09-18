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
  assert.match(merkle, /human_authorized === true/);
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
