import assert from 'node:assert/strict';
import test from 'node:test';
import { clearStaleCache, getStaleCache, putStaleCache } from '../server/reliability/stale-cache.mjs';

test('stale cache returns last-known-good data with explicit stale state', () => {
  clearStaleCache();
  putStaleCache('gage', { stage: 10 }, 1_000);
  assert.deepEqual(getStaleCache('gage', { now: 2_000, maxAgeMs: 5_000 }), {
    value: { stage: 10 }, cachedAt: new Date(1_000).toISOString(), ageMs: 1_000, status: 'stale',
  });
});

test('stale cache expires deterministically', () => {
  clearStaleCache();
  putStaleCache('gage', { stage: 10 }, 1_000);
  assert.equal(getStaleCache('gage', { now: 7_001, maxAgeMs: 5_000 }), null);
});
