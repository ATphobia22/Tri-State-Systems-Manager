export function createMemoryCache({ now = () => Date.now() } = {}) {
  const entries = new Map();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) { entries.delete(key); return null; }
      return entry.value;
    },
    set(key, value, ttlMs) {
      if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('ttlMs must be positive');
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    delete(key) { return entries.delete(key); },
    clear() { entries.clear(); },
    size() { return entries.size; },
  };
}

export const sourceCache = createMemoryCache();
