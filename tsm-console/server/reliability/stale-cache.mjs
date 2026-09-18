const entries = new Map();
const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 64;

export function putStaleCache(key, value, now = Date.now()) {
  if (!key) throw new TypeError('cache key required');
  entries.set(key, { value, cachedAt: now });
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}

export function getStaleCache(key, { maxAgeMs = DEFAULT_MAX_AGE_MS, now = Date.now() } = {}) {
  const entry = entries.get(key);
  if (!entry) return null;
  const ageMs = now - entry.cachedAt;
  if (ageMs < 0 || ageMs > maxAgeMs) return null;
  return { value: entry.value, cachedAt: new Date(entry.cachedAt).toISOString(), ageMs, status: 'stale' };
}

export function clearStaleCache() { entries.clear(); }
