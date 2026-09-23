const metrics = new Map();
const samples = new Map();
const sloSamples = new Map();
const MAX_SAMPLES = 2048;
const HELP = new Map([
  ['tsm_server_memory_rss_bytes', 'Current Node.js resident memory in bytes.'],
  ['tsm_server_memory_heap_used_bytes', 'Current Node.js V8 heap usage in bytes.'],
  ['tsm_telemetry_ingest_total', 'Number of telemetry records accepted by the ingestion boundary.'],
  ['ptdt_usgs_gauge_stage_feet', 'Latest accepted USGS gage-height observation in feet, relative to the source gage datum.'],
  ['ptdt_usgs_discharge_cfs', 'Latest accepted USGS discharge observation in cubic feet per second.'],
  ['tsm_http_requests_total', 'HTTP requests observed by the TSM API.'],
  ['tsm_http_request_latency_seconds', 'Observed TSM API request latency in seconds.'],
  ['tsm_http_request_latency_seconds_p50', 'Measured p50 TSM API request latency in seconds.'],
  ['tsm_http_request_latency_seconds_p95', 'Measured p95 TSM API request latency in seconds.'],
  ['tsm_http_request_latency_seconds_p99', 'Measured p99 TSM API request latency in seconds.'],
  ['tsm_http_errors_total', 'HTTP responses classified as server or upstream errors.'],
  ['tsm_upstream_request_latency_seconds', 'Observed upstream source request latency in seconds.'],
  ['tsm_upstream_request_latency_seconds_p50', 'Measured p50 upstream source request latency in seconds.'],
  ['tsm_upstream_request_latency_seconds_p95', 'Measured p95 upstream source request latency in seconds.'],
  ['tsm_upstream_request_latency_seconds_p99', 'Measured p99 upstream source request latency in seconds.'],
  ['tsm_source_freshness_age_seconds', 'Age of the newest accepted source observation in seconds.'],
  ['tsm_ingestion_records_total', 'Records accepted by an ingestion worker.'],
  ['tsm_ingestion_throughput_records_per_second', 'Measured ingestion throughput for a completed batch.'],
  ['tsm_upstream_retries_total', 'Retry attempts made against upstream sources.'],
  ['tsm_upstream_requests_total', 'Total upstream request attempts.'],
  ['tsm_upstream_retry_ratio', 'Measured upstream retry ratio.'],
  ['tsm_circuit_breaker_state', 'Current circuit-breaker state, one-hot encoded.'],
  ['tsm_cache_requests_total', 'Cache lookups by result.'],
  ['tsm_cache_hit_ratio', 'Measured cache hit ratio.'],
  ['tsm_browser_route_load_seconds', 'Measured browser route-load duration in seconds.'],
  ['tsm_browser_js_chunk_bytes', 'Measured transferred JavaScript chunk size in bytes.'],
  ['tsm_browser_frame_time_seconds', 'Measured browser animation-frame interval; this is not GPU hardware timing.'],
  ['tsm_browser_tile_request_latency_seconds', 'Measured browser 3D/geospatial tile request latency in seconds.'],
  ['tsm_browser_tile_requests_total', 'Browser 3D/geospatial tile request attempts.'],
  ['tsm_browser_tile_failures_total', 'Browser 3D/geospatial tile request failures.'],
  ['tsm_browser_tile_failure_ratio', 'Measured browser 3D/geospatial tile failure ratio.'],
  ['tsm_browser_memory_pressure_ratio', 'Measured JavaScript heap usage divided by the browser heap limit when available.'],
  ['tsm_browser_webgpu_available', 'Browser WebGPU API availability.'],
  ['tsm_browser_webgl_available', 'Browser WebGL context availability.'],
  ['tsm_worker_utilization_ratio', 'Measured ingestion worker pool utilization ratio.'],
  ['tsm_server_event_loop_utilization_ratio', 'Measured Node.js event-loop utilization ratio.'],
  ['tsm_geospatial_query_latency_seconds', 'Measured geospatial query duration in seconds.'],
  ['tsm_hydraulic_job_latency_seconds', 'Measured hydraulic job duration in seconds.'],
  ['tsm_evidence_processing_latency_seconds', 'Measured evidence-processing duration in seconds.'],
  ['tsm_evidence_processing_total', 'Evidence-processing operations by outcome.'],
  ['tsm_slo_good_total', 'SLO measurements that met their configured objective.'],
  ['tsm_slo_bad_total', 'SLO measurements that missed their configured objective.'],
  ['tsm_slo_error_budget_consumed_ratio', 'Rolling in-process SLO error-budget consumption ratio.'],
]);
const SLO_DEFINITIONS = Object.freeze({
  api_availability: { target: 0.999, windowMs: 24 * 60 * 60 * 1000 },
  api_latency_p95: { thresholdSeconds: 0.75, target: 0.95, windowMs: 24 * 60 * 60 * 1000 },
  upstream_latency_p95: { thresholdSeconds: 2.0, target: 0.95, windowMs: 24 * 60 * 60 * 1000 },
  browser_route_load_p95: { thresholdSeconds: 3.0, target: 0.95, windowMs: 24 * 60 * 60 * 1000 },
  tile_request_p95: { thresholdSeconds: 1.5, target: 0.95, windowMs: 24 * 60 * 60 * 1000 },
});
function validateName(name) {
  if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new TypeError('invalid Prometheus metric name: ' + name);
}
function validateValue(value) {
  if (!Number.isFinite(value)) throw new TypeError('metric value must be finite');
}
function normalizeLabels(labels = {}) {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([key]) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
      .map(([key, value]) => [key, String(value).slice(0, 128)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
function metricKey(name, labels) { return name + JSON.stringify(normalizeLabels(labels)); }
function promKey(name, labels) {
  const normalized = normalizeLabels(labels);
  const pairs = Object.entries(normalized).map(([key, value]) => {
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return key + '="' + escaped + '"';
  });
  return name + (pairs.length ? '{' + pairs.join(',') + '}' : '');
}
function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(quantile * sorted.length) - 1))];
}
function pushSample(name, value, labels) {
  const key = metricKey(name, labels);
  const list = samples.get(key) || [];
  list.push(value);
  if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
  samples.set(key, list);
  return list;
}
export function observeTelemetryMetric(name, value, labels = {}) {
  validateName(name); validateValue(value);
  metrics.set(metricKey(name, labels), { name, labels: normalizeLabels(labels), value });
}
export function incrementTelemetryCounter(name, labels = {}, delta = 1) {
  validateName(name);
  if (!Number.isFinite(delta) || delta < 0) throw new TypeError('counter delta must be finite and non-negative');
  const key = metricKey(name, labels);
  const normalized = normalizeLabels(labels);
  const nextValue = (metrics.get(key)?.value ?? 0) + delta;
  metrics.set(key, { name, labels: normalized, value: nextValue });
  if (name === 'tsm_browser_tile_requests_total' || name === 'tsm_browser_tile_failures_total') {
    const requests = [...metrics.values()].filter((entry) => entry.name === 'tsm_browser_tile_requests_total').reduce((sum, entry) => sum + entry.value, 0);
    const failures = [...metrics.values()].filter((entry) => entry.name === 'tsm_browser_tile_failures_total').reduce((sum, entry) => sum + entry.value, 0);
    observeTelemetryMetric('tsm_browser_tile_failure_ratio', requests > 0 ? failures / requests : 0);
  }
  if (name === 'tsm_cache_requests_total') {
    const cache = normalized.cache || 'unknown';
    const hits = [...metrics.values()].filter((entry) => entry.name === name && entry.labels.cache === cache && entry.labels.result === 'hit').reduce((sum, entry) => sum + entry.value, 0);
    const total = [...metrics.values()].filter((entry) => entry.name === name && entry.labels.cache === cache).reduce((sum, entry) => sum + entry.value, 0);
    observeTelemetryMetric('tsm_cache_hit_ratio', total > 0 ? hits / total : 0, { cache });
  }
}
export function observeTelemetryDuration(name, seconds, labels = {}) {
  validateValue(seconds);
  const list = pushSample(name, seconds, labels);
  observeTelemetryMetric(name, seconds, labels);
  for (const [suffix, quantile] of [['p50', 0.50], ['p95', 0.95], ['p99', 0.99]]) {
    observeTelemetryMetric(name + '_' + suffix, percentile(list, quantile), labels);
  }
}
export function observeSlo(sloId, good, labels = {}) {
  const definition = SLO_DEFINITIONS[sloId];
  if (!definition) throw new TypeError('unknown SLO: ' + sloId);
  const now = Date.now();
  const key = metricKey(sloId, labels);
  const retained = (sloSamples.get(key) || []).filter((sample) => sample.timestamp >= now - definition.windowMs);
  retained.push({ timestamp: now, good: Boolean(good) });
  while (retained.length > MAX_SAMPLES) retained.shift();
  sloSamples.set(key, retained);
  incrementTelemetryCounter(good ? 'tsm_slo_good_total' : 'tsm_slo_bad_total', { slo: sloId, ...labels });
  const bad = retained.filter((sample) => !sample.good).length;
  const allowedBad = Math.max(1, retained.length * (1 - definition.target));
  observeTelemetryMetric('tsm_slo_error_budget_consumed_ratio', bad / allowedBad, { slo: sloId, ...labels });
}
export function getSloDefinitions() { return SLO_DEFINITIONS; }
export function renderPrometheusMetrics() {
  const lines = [];
  for (const [name, help] of HELP) {
    const type = name.endsWith('_total') ? 'counter' : 'gauge';
    lines.push('# HELP ' + name + ' ' + help, '# TYPE ' + name + ' ' + type);
    for (const entry of metrics.values()) if (entry.name === name) lines.push(promKey(name, entry.labels) + ' ' + entry.value);
  }
  return lines.join('\n') + '\n';
}
export function resetPrometheusMetrics() { metrics.clear(); samples.clear(); sloSamples.clear(); }
