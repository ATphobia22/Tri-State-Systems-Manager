const health = new Map();

export function recordSourceHealth(sourceId, patch) {
  if (!sourceId) throw new TypeError('sourceId required');
  const previous = health.get(sourceId) || { sourceId, state: 'unknown', successCount: 0, errorCount: 0 };
  const next = { ...previous, ...patch, sourceId, updatedAt: new Date().toISOString() };
  if (patch.ok === true) { next.state = 'healthy'; next.successCount += 1; next.lastSuccessAt = next.updatedAt; }
  if (patch.ok === false) { next.state = 'degraded'; next.errorCount += 1; next.lastErrorAt = next.updatedAt; }
  health.set(sourceId, Object.freeze(next));
  return next;
}

export function getSourceHealth(sourceId) { return health.get(sourceId) || null; }
export function listSourceHealth() { return [...health.values()]; }
export function clearSourceHealth() { health.clear(); }
