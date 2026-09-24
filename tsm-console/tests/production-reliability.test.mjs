import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../server/reliability/rate-limiter.mjs';
import { createDeadLetterQueue } from '../server/reliability/dead-letter-queue.mjs';
import { createRequestJson } from '../server/ingestion/http-client.mjs';

test('rate limiter rejects after bounded request budget', () => {
  let now = 1_000;
  const limiter = createRateLimiter({ windowMs: 1_000, maxRequests: 2, now: () => now });
  assert.equal(limiter.consume('client').allowed, true);
  assert.equal(limiter.consume('client').allowed, true);
  const blocked = limiter.consume('client');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 1_000);
  now += 1_000;
  assert.equal(limiter.consume('client').allowed, true);
});

test('dead letter queue persists bounded unprocessable messages', () => {
  const filePath = `/tmp/tsm-dlq-${process.pid}-${Date.now()}.json`;
  const queue = createDeadLetterQueue({ filePath, maxEntries: 2 });
  queue.enqueue({ event_id: 'a' }, 'INVALID');
  queue.enqueue({ event_id: 'b' }, 'TIMEOUT');
  queue.enqueue({ event_id: 'c' }, 'SCHEMA');
  const rows = queue.list();
  assert.deepEqual(rows.map((row) => row.message.event_id), ['b', 'c']);
});

test('request timeout remains effective when caller supplies an AbortSignal', async () => {
  let observedSignal;
  const fetchImpl = async (_url, options) => {
    observedSignal = options.signal;
    await new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    });
  };
  const breaker = {
    beforeRequest: () => {},
    recordSuccess: () => {},
    recordFailure: () => {},
  };
  await assert.rejects(
    createRequestJson({ fetchImpl, sleepImpl: async () => {}, circuitBreaker: breaker })('https://example.invalid', {
      timeoutMs: 5,
      retries: 0,
      signal: new AbortController().signal,
    }),
    /aborted/,
  );
  assert.equal(observedSignal?.aborted, true);
});
