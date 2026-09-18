import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('verified regulatory rules are jurisdiction-bound', async () => {
  const registry = JSON.parse(await readFile(
    new URL('../../data/regulatory/tsm-floodway-rules-v1.json', import.meta.url),
    'utf8',
  ));

  assert.equal(registry.controls.never_use_as_global_constant, true);
  assert.equal(registry.controls.require_jurisdiction_match, true);
  assert.equal(registry.controls.require_applicability_match, true);
  assert.equal(registry.controls.regulatory_determination_requires_human_review, true);

  const indiana = registry.rules.find((rule) => rule.id === 'IN-FLOODWAY-CAPACITY-0.15FT');
  assert.equal(indiana.jurisdiction, 'IN');
  assert.equal(indiana.threshold, 0.15);
  assert.equal(indiana.status, 'VERIFIED_OFFICIAL_SOURCE');
});
