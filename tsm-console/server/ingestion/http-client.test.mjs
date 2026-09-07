import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestJson } from './http-client.mjs';
import { createCircuitBreaker } from '../reliability/circuit-breaker.mjs';

function response(status, body = '{}', headers = {}) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(headers), text: async () => body };
}

test('HTTP client retries 429 and honors retry-after', async () => {
  let calls = 0;
  const delays = [];
  const request = createRequestJson({ fetchImpl: async () => (++calls === 1 ? response(429, '{}', { 'retry-after': '1' }) : response(200, '{"ok":true}')), sleepImpl: async (ms) => delays.push(ms) });
  assert.deepEqual(await request('https://example.test/data', { retries: 1, sourceId: 'example' }), { ok: true });
  assert.equal(calls, 2);
  assert.equal(delays[0], 1_000);
});

test('HTTP client fails fast for non-retryable client errors', async () => {
  let calls = 0;
  const request = createRequestJson({ fetchImpl: async () => { calls += 1; return response(404); } });
  await assert.rejects(request('https://example.test/data', { retries: 3, sourceId: 'example-404' }), /HTTP 404/);
  assert.equal(calls, 1);
});

test('HTTP client opens circuit after repeated upstream failure', async () => {
  const breaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 100_000 });
  const request = createRequestJson({ circuitBreaker: breaker, fetchImpl: async () => response(503) });
  await assert.rejects(request('https://example.test/data', { retries: 0, sourceId: 'example-503' }), /HTTP 503/);
  await assert.rejects(request('https://example.test/data', { retries: 0, sourceId: 'example-503' }), /circuit open/);
});
