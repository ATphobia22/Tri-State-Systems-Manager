import { observeTelemetryMetric } from '../telemetry/prometheus-exporter.mjs';

const health = new Map();

export function recordSourceHealth(sourceId, patch = {}) {
  if (!sourceId) throw new TypeError('sourceId required');
  const previous = health.get(sourceId) || { sourceId, state: 'unknown', successCount: 0, errorCount: 0 };
  const updatedAt = new Date().toISOString();
  const next = { ...previous, ...patch, sourceId, updatedAt };
  if (patch.ok === true) {
    next.state = 'healthy';
    next.successCount += 1;
    next.lastSuccessAt = updatedAt;
  }
  if (patch.ok === false) {
    next.state = 'degraded';
    next.errorCount += 1;
    next.lastErrorAt = updatedAt;
  }
  if (Number.isFinite(patch.latencyMs)) next.lastLatencyMs = patch.latencyMs;
  if (patch.observedAt) {
    const observedMs = Date.parse(patch.observedAt);
    if (Number.isFinite(observedMs)) {
      const ageSeconds = Math.max(0, (Date.now() - observedMs) / 1000);
      next.freshnessAgeSeconds = ageSeconds;
      observeTelemetryMetric('tsm_source_freshness_age_seconds', ageSeconds, { source_id: sourceId });
    }
  }
  health.set(sourceId, Object.freeze(next));
  return next;
}

export function getSourceHealth(sourceId) { return health.get(sourceId) || null; }
export function listSourceHealth() { return [...health.values()].map((entry) => ({ ...entry })); }
export function clearSourceHealth() { health.clear(); }
