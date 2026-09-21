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


test('circuit breaker permits only one half-open probe', () => {
  let now = 1_000;
  const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 100, now: () => now });
  breaker.recordFailure('source');
  now += 100;
  assert.equal(breaker.beforeRequest('source').state, 'half-open');
  assert.throws(() => breaker.beforeRequest('source'), CircuitOpenError);
});

test('retry success is reported as success after an earlier retryable failure', async () => {
  let calls = 0;
  let metrics;
  const breaker = {
    beforeRequest: () => {},
    recordSuccess: () => {},
    recordFailure: () => {},
  };
  const result = await (await import('../server/ingestion/http-client.mjs')).createRequestJson({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response('busy', { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    sleepImpl: async () => {},
    circuitBreaker: breaker,
  })('https://example.invalid', { retries: 1, timeoutMs: 100, jitterMs: 0, onMetrics: (value) => { metrics = value; } });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 2);
  assert.equal(metrics.ok, true);
});
