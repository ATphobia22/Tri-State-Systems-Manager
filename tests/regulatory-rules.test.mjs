import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('active regulatory registry is source-bound and fail-closed', async () => {
  const registry = JSON.parse(await readFile(
    new URL('../data/regulatory/tsm-floodway-rules-v1.json', import.meta.url),
    'utf8',
  ));

  assert.equal(registry.controls.never_use_as_global_constant, true);
  assert.equal(registry.controls.require_jurisdiction_match, true);
  assert.equal(registry.controls.require_applicability_match, true);
  assert.equal(registry.controls.regulatory_determination_requires_human_review, true);
  assert.ok(registry.rules.length >= 4);

  for (const rule of registry.rules) {
    assert.match(rule.sourceUrl, /^https:\/\//);
    assert.equal(rule.status, 'VERIFIED_OFFICIAL_SOURCE');
  }
});
