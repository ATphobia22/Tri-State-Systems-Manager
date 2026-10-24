import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const register = JSON.parse(readFileSync(new URL('integrations/open-source-candidate-register.json', root), 'utf8'));
const review = readFileSync(new URL('docs/research/OPEN-SOURCE-ECOSYSTEM-ADOPTION-REVIEW.md', root), 'utf8');

test('open-source candidates are research-only and not runtime integrations', () => {
  assert.equal(register.status, 'research-only-no-dependencies-added');
  assert.equal(register.policy.canonicalUpstreamRequired, true);
  assert.equal(register.policy.licenseMustBeVerified, true);
  assert.equal(register.policy.independentValidationRequiredForEngineeringAlgorithms, true);
  assert.ok(register.candidates.length >= 5);
  assert.ok(register.candidates.every((candidate) => candidate.status === 'not-integrated'));
});

test('review preserves licensing and engineering validation gates', () => {
  assert.match(review, /Do not add a dependency merely because it is popular/i);
  assert.match(review, /GPL-3\.0/);
  assert.match(review, /independent cross-checks/i);
  assert.match(review, /No new geospatial runtime dependency was installed/i);
});
