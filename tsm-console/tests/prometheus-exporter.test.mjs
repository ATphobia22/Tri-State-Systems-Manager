import assert from 'node:assert/strict';
import test from 'node:test';
import { incrementTelemetryCounter, observeTelemetryMetric, renderPrometheusMetrics, resetPrometheusMetrics } from '../server/telemetry/prometheus-exporter.mjs';

test('hydrology counters and circuit state render as valid Prometheus metrics', () => {
  resetPrometheusMetrics();
  incrementTelemetryCounter('tsm_hydrology_api_responses_total', { source_id: 'USGS-NWIS', status: 'SUCCESS' });
  incrementTelemetryCounter('tsm_hydrology_api_responses_total', { source_id: 'USGS-NWIS', status: 'SOURCE_UNAVAILABLE' });
  observeTelemetryMetric('tsm_hydrology_circuit_breaker_state', 1, { source_id: 'USGS-NWIS', state: 'OPEN' });
  const output = renderPrometheusMetrics();
  assert.match(output, /# TYPE tsm_hydrology_api_responses_total counter/);
  assert.match(output, /status="SUCCESS"/);
  assert.match(output, /state="OPEN"\} 1/);
});
