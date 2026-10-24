#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const policyPath = new URL('../../data/geodesy/station-datum-modernization-policy-v1.json', import.meta.url);
const schemaPath = new URL('../../data/schemas/station-datum-modernization-policy-v1.json', import.meta.url);
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));

assert.equal(policy.version, '1.0.0');
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.deepEqual(policy.active_default, {
  horizontal: 'NAD83(2011)',
  vertical: 'NAVD88',
  realization_epoch: '2010.00',
});
assert.equal(policy.transformation_policy.allow_silent_conversion, false);
assert.equal(policy.transformation_policy.require_approved_grid, true);
assert.equal(policy.transformation_policy.unsupported_action, 'MARK_UNAVAILABLE');
assert.equal(policy.transformation_policy.preliminary_frames_transformable, false);
assert.ok(policy.supported_frames.horizontal.includes('NATRF2022_PRELIMINARY'));
assert.ok(policy.supported_frames.vertical.includes('NAPGD2022_PRELIMINARY'));
assert.ok(!policy.active_default.horizontal.includes('PRELIMINARY'));
assert.ok(!policy.active_default.vertical.includes('PRELIMINARY'));

for (const key of ['horizontal', 'vertical']) {
  assert.equal(new Set(policy.supported_frames[key]).size, policy.supported_frames[key].length, `duplicate ${key} frame`);
}
console.log('PASS station datum policy: NAVD88/NAD83(2011) defaults retained; preliminary NSRS frames are non-transformable without explicit policy change.');
