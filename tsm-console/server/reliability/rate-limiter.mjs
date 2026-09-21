export class RateLimitError extends Error {
  constructor(retryAfterMs) {
    super('rate limit exceeded');
    this.name = 'RateLimitError';
    this.code = 'RATE_LIMITED';
    this.retryAfterMs = retryAfterMs;
  }
}

export function createRateLimiter({
  windowMs = 60_000,
  maxRequests = 120,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new RangeError('windowMs must be >= 1');
  if (!Number.isInteger(maxRequests) || maxRequests < 1) throw new RangeError('maxRequests must be >= 1');

  const buckets = new Map();

  function consume(key) {
    if (!key) throw new TypeError('rate-limit key required');
    const currentTime = now();
    const current = buckets.get(key);
    const bucket = !current || current.expiresAt <= currentTime
      ? { count: 0, expiresAt: currentTime + windowMs }
      : current;

    if (bucket.count >= maxRequests) {
      return Object.freeze({
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, bucket.expiresAt - currentTime),
        resetAt: bucket.expiresAt,
      });
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    return Object.freeze({
      allowed: true,
      remaining: Math.max(0, maxRequests - bucket.count),
      retryAfterMs: 0,
      resetAt: bucket.expiresAt,
    });
  }

  function prune() {
    const currentTime = now();
    for (const [key, bucket] of buckets) if (bucket.expiresAt <= currentTime) buckets.delete(key);
  }

  return Object.freeze({ consume, prune, size: () => buckets.size });
}
