const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status) {
  return Number.isInteger(status) && RETRYABLE_STATUSES.has(status);
}

export function parseRetryAfter(value, nowMs = Date.now()) {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const timestamp = Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, timestamp - nowMs), 60_000);
}

export function retryDelayMs({ attempt, retryAfterMs = null, baseMs = 250, maxMs = 10_000, jitterMs = 0, random = Math.random }) {
  if (!Number.isInteger(attempt) || attempt < 0) throw new RangeError('attempt must be a non-negative integer');
  const exponential = Math.min(maxMs, baseMs * (2 ** attempt));
  const retryAfter = retryAfterMs == null ? 0 : Math.max(0, retryAfterMs);
  const jitter = jitterMs > 0 ? Math.floor(random() * jitterMs) : 0;
  return Math.min(maxMs, Math.max(exponential, retryAfter) + jitter);
}
