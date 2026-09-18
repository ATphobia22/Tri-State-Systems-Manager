/** Typed resilient hydrologic ingestion primitive. */
export type RiverStatus = 'LIVE' | 'STALE' | 'SOURCE_UNAVAILABLE';

export interface RiverObservation {
  readonly stationId: string;
  readonly observedAt: string | null;
  readonly retrievedAt: string;
  readonly stageFt: number | null;
  readonly dischargeCfs: number | null;
  readonly status: RiverStatus;
  readonly provisional: boolean;
  readonly sourceUri: string;
  readonly cacheAgeSeconds: number | null;
}

export interface RiverSource {
  readonly fetch: (signal: AbortSignal) => Promise<Omit<RiverObservation, 'status' | 'cacheAgeSeconds'>>;
}

export interface LastKnownGoodCache {
  readonly read: (stationId: string) => Promise<RiverObservation | null>;
  readonly write: (observation: RiverObservation) => Promise<void>;
}

export interface CircuitBreaker {
  readonly failures: number;
  readonly openedAtMs: number | null;
}

export interface ResiliencyOptions {
  readonly failureThreshold?: number;
  readonly resetTimeoutMs?: number;
  readonly requestTimeoutMs?: number;
  readonly maxCacheAgeSeconds?: number;
}

export function createRiverCircuitBreaker(options: ResiliencyOptions = {}) {
  const threshold = options.failureThreshold ?? 3;
  const resetTimeoutMs = options.resetTimeoutMs ?? 30_000;

  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new RangeError('failureThreshold must be a positive integer');
  }
  if (!Number.isFinite(resetTimeoutMs) || resetTimeoutMs < 0) {
    throw new RangeError('resetTimeoutMs must be non-negative');
  }

  let failures = 0;
  let openedAtMs: number | null = null;

  return {
    snapshot(): CircuitBreaker {
      return { failures, openedAtMs };
    },
    allow(now = Date.now()): boolean {
      return openedAtMs === null || now - openedAtMs >= resetTimeoutMs;
    },
    success(): void {
      failures = 0;
      openedAtMs = null;
    },
    failure(now = Date.now()): void {
      failures += 1;
      if (failures >= threshold) {
        openedAtMs = now;
      }
    },
  };
}

function finiteOrNull(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) throw new TypeError('hydrologic value must be finite or null');
  return value;
}

function parseObservedAt(observedAt: string | null): number {
  if (observedAt === null) return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  const age = (Date.now() - timestamp) / 1000;
  return age >= 0 ? age : Number.POSITIVE_INFINITY;
}

function cacheAge(observation: RiverObservation): number {
  return parseObservedAt(observation.observedAt);
}

function readFreshCache(
  cache: LastKnownGoodCache,
  stationId: string,
  maxCacheAgeSeconds: number,
): Promise<RiverObservation | null> {
  return cache.read(stationId).then((cached): RiverObservation | null => {
    if (!cached) return null;
    const age = cacheAge(cached);
    if (age > maxCacheAgeSeconds) return null;
    const stale: RiverObservation = {
      ...cached,
      status: 'STALE',
      cacheAgeSeconds: age,
    };
    return stale;
  }).catch(() => null);
}

export async function ingestRiverObservation(
  stationId: string,
  source: RiverSource,
  cache: LastKnownGoodCache,
  breaker: ReturnType<typeof createRiverCircuitBreaker>,
  options: ResiliencyOptions = {},
): Promise<RiverObservation> {
  if (!stationId) throw new TypeError('stationId is required');

  const timeoutMs = options.requestTimeoutMs ?? 10_000;
  const maxCacheAgeSeconds = options.maxCacheAgeSeconds ?? 86_400;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('requestTimeoutMs must be positive');
  }
  if (!Number.isFinite(maxCacheAgeSeconds) || maxCacheAgeSeconds < 0) {
    throw new RangeError('maxCacheAgeSeconds must be non-negative');
  }

  const unavailable = (cacheAgeSeconds: number | null = null): RiverObservation => ({
    stationId,
    observedAt: null,
    retrievedAt: new Date().toISOString(),
    stageFt: null,
    dischargeCfs: null,
    status: 'SOURCE_UNAVAILABLE',
    provisional: false,
    sourceUri: '',
    cacheAgeSeconds,
  });

  if (!breaker.allow()) {
    return (await readFreshCache(cache, stationId, maxCacheAgeSeconds)) ?? unavailable();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const observation = await source.fetch(controller.signal);
    const validated: Omit<RiverObservation, 'status' | 'cacheAgeSeconds'> = {
      ...observation,
      stageFt: finiteOrNull(observation.stageFt),
      dischargeCfs: finiteOrNull(observation.dischargeCfs),
    };

    breaker.success();

    const live: RiverObservation = {
      ...validated,
      stationId,
      status: 'LIVE',
      cacheAgeSeconds: 0,
    };

    try {
      await cache.write(live);
    } catch {
      // Cache persistence failure does not invalidate a valid live source observation.
    }

    return live;
  } catch {
    breaker.failure();
    return (await readFreshCache(cache, stationId, maxCacheAgeSeconds)) ?? unavailable();
  } finally {
    clearTimeout(timer);
  }
}
