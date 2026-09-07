export const FRESHNESS_STATES = Object.freeze({ FRESH: 'fresh', DELAYED: 'delayed', STALE: 'stale', UNKNOWN: 'unknown' });

export function classifyFreshness({ observedAt = null, retrievedAt = null, maxAgeMs, nowMs = Date.now() }) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) throw new RangeError('maxAgeMs must be non-negative');
  const timestamp = observedAt || retrievedAt;
  if (!timestamp) return FRESHNESS_STATES.UNKNOWN;
  const ageMs = nowMs - Date.parse(timestamp);
  if (!Number.isFinite(ageMs) || ageMs < 0) return FRESHNESS_STATES.UNKNOWN;
  if (ageMs <= maxAgeMs) return FRESHNESS_STATES.FRESH;
  if (ageMs <= maxAgeMs * 2) return FRESHNESS_STATES.DELAYED;
  return FRESHNESS_STATES.STALE;
}

export function isLiveFreshness(state) {
  return state === FRESHNESS_STATES.FRESH;
}
