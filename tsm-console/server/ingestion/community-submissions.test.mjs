import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCommunityObservation } from './community-submissions.mjs';

test('community observations accept bounded public payloads', () => {
  const payload = validateCommunityObservation({ lat: 37.97, lon: -87.55, payload: { observed_water_level: 'bankfull' } });
  assert.equal(payload.observed_water_level, 'bankfull');
});

test('community observations reject invalid coordinates', () => {
  assert.throws(() => validateCommunityObservation({ lat: 120, lon: 0 }), /latitude out of range/);
});

test('community observations reject oversized payloads', () => {
  assert.throws(() => validateCommunityObservation({ payload: { value: 'x'.repeat(257_000) } }), /256 KB/);
});
