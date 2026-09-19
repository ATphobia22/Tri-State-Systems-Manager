import { randomUUID } from 'node:crypto';
import { createCircuitBreaker, CircuitOpenError } from '../reliability/circuit-breaker.mjs';
import { isRetryableStatus, parseRetryAfter, retryDelayMs } from '../reliability/retry-policy.mjs';
import { recordSourceHealth } from './source-health.mjs';
import { incrementTelemetryCounter, observeTelemetryMetric } from '../telemetry/prometheus-exporter.mjs';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_RETRIES = 2;
const defaultCircuitBreaker = createCircuitBreaker();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordHydrologyMetric(options, sourceId, status, startedAt) {
  if (options.telemetryDomain !== 'hydrology') return;
  incrementTelemetryCounter('tsm_hydrology_api_responses_total', { source_id: sourceId, status });
  observeTelemetryMetric('tsm_hydrology_api_request_latency_seconds', (Date.now() - startedAt) / 1000, { source_id: sourceId, quantile: '0.95' });
}

function recordCircuitMetric(options, sourceId, circuitState) {
  if (options.telemetryDomain !== 'hydrology') return;
  observeTelemetryMetric('tsm_hydrology_circuit_breaker_state', circuitState === 'open' ? 1 : 0, { source_id: sourceId, state: circuitState === 'open' ? 'OPEN' : circuitState === 'half-open' ? 'HALF_OPEN' : 'CLOSED' });
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
          recordSourceHealth(sourceId, { ok: true, latencyMs: Date.now() - startedAt, requestId });
          recordHydrologyMetric(options, sourceId, 'SUCCESS', startedAt);
          return payload;
        } catch (error) {
          lastError = error;
          const retryable = isRetryableStatus(error.status) || error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
          if (error instanceof CircuitOpenError || attempt >= retries || !retryable || options.signal?.aborted) break;
          await sleepImpl(retryDelayMs({ attempt, retryAfterMs: error.retryAfterMs }));
        }
      }
      circuitState = circuitBreaker.recordFailure(sourceId);
      recordCircuitMetric(options, sourceId, circuitState.state);
      recordSourceHealth(sourceId, { ok: false, latencyMs: Date.now() - startedAt, requestId, errorCode: lastError?.code || 'HTTP_' + (lastError?.status || 'UNKNOWN') });
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