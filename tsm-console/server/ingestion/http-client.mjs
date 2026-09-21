import { randomUUID } from 'node:crypto';
import { createCircuitBreaker, CircuitOpenError } from '../reliability/circuit-breaker.mjs';
import { isRetryableStatus, parseRetryAfter, retryDelayMs } from '../reliability/retry-policy.mjs';
import { recordSourceHealth } from './source-health.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_JITTER_MS = 100;
const defaultCircuitBreaker = createCircuitBreaker();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequestJson({ fetchImpl = globalThis.fetch, sleepImpl = sleep, circuitBreaker = defaultCircuitBreaker } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  return async function requestJson(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const retries = options.retries ?? DEFAULT_RETRIES;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be > 0');
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) throw new RangeError('maxBytes must be > 0');
    if (!Number.isInteger(retries) || retries < 0) throw new RangeError('retries must be >= 0');

    const sourceId = options.sourceId || new URL(url).hostname;
    const requestId = options.requestId || randomUUID();
    const headers = { accept: 'application/json', 'x-tsm-request-id': requestId, ...(options.headers || {}) };
    let lastError = null;
    circuitBreaker.beforeRequest(sourceId);
    const startedAt = Date.now();

    try {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          let signal = controller.signal;
          let removeCallerAbort = null;
          if (options.signal) {
            const abortCaller = () => controller.abort();
            if (options.signal.aborted) controller.abort();
            else {
              options.signal.addEventListener('abort', abortCaller, { once: true });
              removeCallerAbort = () => options.signal.removeEventListener('abort', abortCaller);
            }
            signal = controller.signal;
          }
          let response;
          try {
            response = await fetchImpl(url, { ...options, headers, signal });
          } finally {
            clearTimeout(timer);
            removeCallerAbort?.();
          }
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.status = response.status;
            error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
            throw error;
          }
          const length = Number(response.headers.get('content-length') || 0);
          if (Number.isFinite(length) && length > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
          const text = await response.text();
          if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`response exceeds size limit (${maxBytes} bytes)`);
          const payload = JSON.parse(text);
          lastError = null;
          circuitBreaker.recordSuccess(sourceId);
          recordSourceHealth(sourceId, { ok: true, latencyMs: Date.now() - startedAt, requestId });
          return payload;
        } catch (error) {
          lastError = error;
          const retryable = isRetryableStatus(error.status) || error.name === 'AbortError'
            || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
          if (error instanceof CircuitOpenError || attempt >= retries || !retryable || options.signal?.aborted) break;
          await sleepImpl(retryDelayMs({ attempt, retryAfterMs: error.retryAfterMs, jitterMs: options.jitterMs ?? DEFAULT_JITTER_MS }));
        }
      }
      circuitBreaker.recordFailure(sourceId);
      recordSourceHealth(sourceId, {
        ok: false, latencyMs: Date.now() - startedAt, requestId,
        errorCode: lastError?.code || `HTTP_${lastError?.status || 'UNKNOWN'}`,
      });
      throw lastError;
    } finally {
      if (options.onMetrics) options.onMetrics({
        sourceId, requestId, latencyMs: Date.now() - startedAt, ok: lastError === null,
      });
    }
  };
}

export function listUpstreamCircuitHealth() { return defaultCircuitBreaker.list(); }
export const requestJson = createRequestJson();
