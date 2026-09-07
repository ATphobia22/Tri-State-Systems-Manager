import test from 'node:test';
import assert from 'node:assert/strict';
import { createCircuitBreaker, CircuitOpenError } from '../server/reliability/circuit-breaker.mjs';
import { classifyFreshness, FRESHNESS_STATES } from '../server/reliability/freshness.mjs';
import { isRetryableStatus, parseRetryAfter, retryDelayMs } from '../server/reliability/retry-policy.mjs';

test('circuit opens after threshold and permits half-open probe after cooldown', () => {
  let now = 1_000;
  const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 500, now: () => now });
  breaker.recordFailure('usgs');
  breaker.recordFailure('usgs');
  assert.equal(breaker.getState('usgs').state, 'open');
  assert.throws(() => breaker.beforeRequest('usgs'), CircuitOpenError);
  now += 500;
  assert.equal(breaker.beforeRequest('usgs').state, 'half-open');
  breaker.recordSuccess('usgs');
  assert.equal(breaker.getState('usgs').state, 'closed');
});

test('retry policy distinguishes retryable statuses and honors bounded Retry-After', () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(parseRetryAfter('2', 0), 2_000);
  assert.equal(retryDelayMs({ attempt: 1, retryAfterMs: 5_000, jitterMs: 0 }), 5_000);
});

test('freshness is independent from transport health', () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  assert.equal(classifyFreshness({ observedAt: '2026-09-07T11:55:00Z', maxAgeMs: 15 * 60_000, nowMs: now }), FRESHNESS_STATES.FRESH);
  assert.equal(classifyFreshness({ observedAt: '2026-09-07T11:20:00Z', maxAgeMs: 15 * 60_000, nowMs: now }), FRESHNESS_STATES.STALE);
});
