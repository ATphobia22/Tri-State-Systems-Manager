import test from 'node:test';
import assert from 'node:assert/strict';
import {
  incrementTelemetryCounter,
  observeTelemetryMetric,
  renderPrometheusMetrics,
  resetPrometheusMetrics,
} from '../server/telemetry/prometheus-exporter.mjs';

test.afterEach(() => resetPrometheusMetrics());

test('hydrology reliability metrics render for alert rules', () => {
  incrementTelemetryCounter('tsm_hydrology_api_responses_total', { source: 'USGS', status: 'SOURCE_UNAVAILABLE' });
  observeTelemetryMetric('tsm_hydrology_circuit_breaker_state', 1, { source: 'USGS', state: 'OPEN' });
  observeTelemetryMetric('tsm_hydrology_api_request_latency_seconds', 5.5, { source: 'USGS' });
  const output = renderPrometheusMetrics();
  assert.match(output, /tsm_hydrology_api_responses_total\{source="USGS",status="SOURCE_UNAVAILABLE"\} 1/);
  assert.match(output, /tsm_hydrology_circuit_breaker_state\{source="USGS",state="OPEN"\} 1/);
  assert.match(output, /tsm_hydrology_api_request_latency_seconds\{source="USGS"\} 5\.5/);
});
