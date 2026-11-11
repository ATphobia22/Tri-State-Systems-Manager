import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reg = JSON.parse(readFileSync(new URL('../../integrations/geobim-oss-candidates.v1.json', import.meta.url), 'utf8'));
const sha = /^[0-9a-f]{40}$/;
const spdx = new Set(['MIT', 'Apache-2.0', 'GPL-3.0']);

test('every fork has pinned provenance, upstream and reviewed license', () => {
  assert.equal(reg.schemaVersion, 'tsm.geobim.oss-candidates.v1');
  assert.equal(reg.releaseStatus, 'research-only-no-dependencies-added');
  assert.equal(reg.forks.length, 7);
  const names = new Set();
  for (const entry of reg.forks) {
    assert.match(entry.fork, /^ATphobia22\/[\w-]+$/);
    assert.match(entry.upstream, /^[\w-]+\/[\w-]+$/);
    assert.match(entry.sourceCommit, sha);
    assert.ok(spdx.has(entry.reportedLicense));
    assert.equal(entry.status, 'candidate-not-integrated');
    assert.ok(!names.has(entry.name));
    names.add(entry.name);
  }
});

test('no external renderer or unreviewed BIM source is silently approved', () => {
  const xeokit = reg.priorities.find(x => x.project === 'xeokit');
  assert.equal(xeokit.status, 'blocked-license-review');
  assert.match(xeokit.license, /AGPL/);
  const required = ['license-and-notices-reviewed', 'source-identity-and-sha256',
    'explicit-horizontal-crs-units-and-vertical-datum',
    'packaged-unreal-shipping-evidence-separate'];
  for (const gate of required) assert.ok(reg.mandatoryGates.includes(gate));
  assert.ok(reg.forks.every(f => f.status !== 'integrated'));
});
