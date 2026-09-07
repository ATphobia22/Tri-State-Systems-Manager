import { createCircuitBreaker, CircuitOpenError } from '../reliability/circuit-breaker.mjs';
import { isRetryableStatus, parseRetryAfter, retryDelayMs } from '../reliability/retry-policy.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequestJson({ fetchImpl = globalThis.fetch, sleepImpl = sleep, circuitBreaker = createCircuitBreaker() } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  return async function requestJson(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const sourceId = options.sourceId || new URL(url).hostname;
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    let lastError;

    circuitBreaker.beforeRequest(sourceId);
    const startedAt = Date.now();
    try {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        let response;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            response = await fetchImpl(url, { ...options, headers, signal: options.signal ?? controller.signal });
          } finally {
            clearTimeout(timer);
          }
          if (!response.ok) {
            const retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            error.retryAfterMs = retryAfterMs;
            throw error;
          }
          const length = Number(response.headers.get('content-length') || 0);
          if (length > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
          const text = await response.text();
          if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
          const payload = JSON.parse(text);
          circuitBreaker.recordSuccess(sourceId);
          return payload;
        } catch (error) {
          lastError = error;
          const retryable = error instanceof CircuitOpenError || isRetryableStatus(error.status) || error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
          if (error instanceof CircuitOpenError || attempt >= retries || !retryable || options.signal?.aborted) break;
          await sleepImpl(retryDelayMs({ attempt, retryAfterMs: error.retryAfterMs }));
        }
      }
      circuitBreaker.recordFailure(sourceId);
      throw lastError;
    } finally {
      if (options.onMetrics) options.onMetrics({ sourceId, latencyMs: Date.now() - startedAt, ok: !lastError });
    }
  };
}

export const requestJson = createRequestJson();
