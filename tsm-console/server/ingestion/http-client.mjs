import { randomUUID } from 'node:crypto';
import { createCircuitBreaker, CircuitOpenError } from '../reliability/circuit-breaker.mjs';
import { isRetryableStatus, parseRetryAfter, retryDelayMs } from '../reliability/retry-policy.mjs';
import { recordSourceHealth } from './source-health.mjs';
import { incrementTelemetryCounter, observeTelemetryDuration, observeTelemetryMetric } from '../telemetry/prometheus-exporter.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_JITTER_MS = 1_000;
const defaultCircuitBreaker = createCircuitBreaker();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordHydrologyMetric(options, sourceId, status, startedAt) {
  if (options.telemetryDomain !== 'hydrology') return;
  incrementTelemetryCounter('tsm_hydrology_api_responses_total', { source_id: sourceId, status });
  observeTelemetryMetric('tsm_hydrology_api_request_latency_seconds', (Date.now() - startedAt) / 1000, { source_id: sourceId });
}

function recordCircuitMetric(options, sourceId, circuitState) {
  if (options.telemetryDomain !== 'hydrology') return;
  const activeState = circuitState === 'open' ? 'OPEN' : circuitState === 'half-open' ? 'HALF_OPEN' : 'CLOSED';
  for (const state of ['CLOSED', 'HALF_OPEN', 'OPEN']) {
    observeTelemetryMetric('tsm_hydrology_circuit_breaker_state', state === activeState ? 1 : 0, { source_id: sourceId, state });
  }
}

export function createRequestJson({ fetchImpl = globalThis.fetch, sleepImpl = sleep, circuitBreaker = defaultCircuitBreaker } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  return async function requestJson(url, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const retries = options.retries ?? DEFAULT_RETRIES;
    const sourceId = options.sourceId || new URL(url).hostname;
    const requestId = options.requestId || randomUUID();
    const headers = { accept: 'application/json', 'x-tsm-request-id': requestId, ...(options.headers || {}) };
    const startedAt = Date.now();
    let attemptsMade = 0;
    let lastError;
    let circuitState;
    try {
      circuitState = circuitBreaker.beforeRequest(sourceId);
      recordCircuitMetric(options, sourceId, circuitState.state);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        recordCircuitMetric(options, sourceId, 'open');
        recordHydrologyMetric(options, sourceId, 'CIRCUIT_OPEN', startedAt);
      }
      throw error;
    }
    try {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        attemptsMade += 1;
        incrementTelemetryCounter('tsm_upstream_requests_total', { source_id: sourceId });
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          let response;
          try {
            response = await fetchImpl(url, { ...options, headers, signal: options.signal ?? controller.signal });
          } finally { clearTimeout(timer); }
          if (!response.ok) {
            const error = new Error('HTTP ' + response.status);
            error.status = response.status;
            error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
            throw error;
          }
          const length = Number(response.headers.get('content-length') || 0);
          if (length > maxBytes) throw new Error('response exceeds size limit (' + maxBytes + ' bytes)');
          const text = await response.text();
          if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('response exceeds size limit (' + maxBytes + ' bytes)');
          const payload = JSON.parse(text);
          circuitState = circuitBreaker.recordSuccess(sourceId);
          recordCircuitMetric(options, sourceId, circuitState.state);
          const latencyMs = Date.now() - startedAt;
          recordSourceHealth(sourceId, { ok: true, latencyMs, requestId });
          observeTelemetryDuration('tsm_upstream_request_latency_seconds', latencyMs / 1000, { source_id: sourceId });
          observeTelemetryMetric('tsm_upstream_retry_ratio', attemptsMade > 0 ? (attemptsMade - 1) / attemptsMade : 0, { source_id: sourceId });
          recordHydrologyMetric(options, sourceId, 'SUCCESS', startedAt);
          return payload;
        } catch (error) {
          lastError = error;
          const retryable = isRetryableStatus(error.status) || error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
          if (error instanceof CircuitOpenError || attempt >= retries || !retryable || options.signal?.aborted) break;
          incrementTelemetryCounter('tsm_upstream_retries_total', { source_id: sourceId });
          await sleepImpl(retryDelayMs({ attempt, retryAfterMs: error.retryAfterMs, jitterMs: options.retryJitterMs ?? DEFAULT_RETRY_JITTER_MS, random: options.retryRandom ?? Math.random }));
        }
      }
      circuitState = circuitBreaker.recordFailure(sourceId);
      recordCircuitMetric(options, sourceId, circuitState.state);
      const latencyMs = Date.now() - startedAt;
      recordSourceHealth(sourceId, { ok: false, latencyMs, requestId, errorCode: lastError?.code || 'HTTP_' + (lastError?.status || 'UNKNOWN') });
      observeTelemetryDuration('tsm_upstream_request_latency_seconds', latencyMs / 1000, { source_id: sourceId });
      observeTelemetryMetric('tsm_upstream_retry_ratio', attemptsMade > 0 ? (attemptsMade - 1) / attemptsMade : 0, { source_id: sourceId });
      const status = lastError?.name === 'AbortError' || lastError?.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'SOURCE_UNAVAILABLE';
      recordHydrologyMetric(options, sourceId, status, startedAt);
      throw lastError;
    } finally {
      if (options.onMetrics) options.onMetrics({ sourceId, requestId, latencyMs: Date.now() - startedAt, ok: !lastError });
    }
  };
}

export function listUpstreamCircuitHealth() { return defaultCircuitBreaker.list(); }
export const requestJson = createRequestJson();
