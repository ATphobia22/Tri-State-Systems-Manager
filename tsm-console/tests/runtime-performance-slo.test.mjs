import assert from 'node:assert/strict';
import test from 'node:test';
import {
  incrementTelemetryCounter,
  observeSlo,
  observeTelemetryDuration,
  renderPrometheusMetrics,
  resetPrometheusMetrics,
} from '../server/telemetry/prometheus-exporter.mjs';

test('runtime exporter measures p50/p95/p99 latency and error budget consumption', () => {
  resetPrometheusMetrics();
  for (const seconds of [0.1, 0.2, 0.3, 0.4, 0.8, 1.0]) observeTelemetryDuration('tsm_http_request_latency_seconds', seconds, { route: 'health' });
  for (let index = 0; index < 100; index += 1) observeSlo('api_availability', index < 99, { route: 'health' });
  const output = renderPrometheusMetrics();
  assert.match(output, /tsm_http_request_latency_seconds_p50\{route="health"\}/);
  assert.match(output, /tsm_http_request_latency_seconds_p95\{route="health"\}/);
  assert.match(output, /tsm_http_request_latency_seconds_p99\{route="health"\}/);
  assert.match(output, /tsm_slo_error_budget_consumed_ratio\{route="health",slo="api_availability"\}/);
});

test('cache hit ratio is derived from bounded hit/miss counters', () => {
  resetPrometheusMetrics();
  incrementTelemetryCounter('tsm_cache_requests_total', { cache: 'hydrologic_stale', result: 'hit' });
  incrementTelemetryCounter('tsm_cache_requests_total', { cache: 'hydrologic_stale', result: 'miss' });
  const output = renderPrometheusMetrics();
  assert.match(output, /tsm_cache_hit_ratio\{cache="hydrologic_stale"\} 0.5/);
});
