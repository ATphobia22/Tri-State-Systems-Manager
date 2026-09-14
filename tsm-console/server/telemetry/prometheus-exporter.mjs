const metrics = new Map();

function metricKey(name, labels) {
  const ordered = Object.entries(labels ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return `${name}{${ordered.map(([key, value]) => `${key}="${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"') }"`).join(',')}}`;
}

export function observeTelemetryMetric(name, value, labels = {}) {
  if (!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name)) throw new TypeError(`invalid Prometheus metric name: ${name}`);
  if (!Number.isFinite(value)) throw new TypeError('metric value must be finite');
  metrics.set(metricKey(name, labels), value);
}

export function incrementTelemetryCounter(name, labels = {}, delta = 1) {
  if (!Number.isFinite(delta) || delta < 0) throw new TypeError('counter delta must be finite and non-negative');
  const key = metricKey(name, labels);
  metrics.set(key, (metrics.get(key) ?? 0) + delta);
}

export function renderPrometheusMetrics() {
  const lines = [
    '# HELP tsm_telemetry_ingest_total Number of telemetry records accepted by the ingestion boundary.',
    '# TYPE tsm_telemetry_ingest_total counter',
  ];
  for (const [key, value] of metrics) lines.push(`${key} ${value}`);
  return `${lines.join('\n')}\n`;
}

export function resetPrometheusMetrics() { metrics.clear(); }
