/** Typed resilient hydrologic ingestion primitive. */
export type RiverStatus = 'LIVE' | 'STALE' | 'SOURCE_UNAVAILABLE';

export interface RiverObservation {
  readonly stationId: string;
  readonly observedAt: string;
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
  let failures = 0;
  let openedAtMs: number | null = null;

  return {
    snapshot(): CircuitBreaker { return { failures, openedAtMs }; },
    allow(now = Date.now()): boolean {
      return openedAtMs === null || now - openedAtMs >= resetTimeoutMs;
    },
    success(): void { failures = 0; openedAtMs = null; },
    failure(now = Date.now()): void {
      failures += 1;
      if (failures >= threshold) openedAtMs = now;
    },
  };
}

function finiteOrNull(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) throw new TypeError('hydrologic value must be finite or null');
  return value;
}

export async function ingestRiverObservation(
  stationId: string,
  source: RiverSource,
  cache: LastKnownGoodCache,
  breaker: ReturnType<typeof createRiverCircuitBreaker>,
  options: ResiliencyOptions = {},
): Promise<RiverObservation> {
  const timeoutMs = options.requestTimeoutMs ?? 10_000;
  const maxCacheAgeSeconds = options.maxCacheAgeSeconds ?? 86_400;
  const unavailable = (cacheAgeSeconds: number | null = null): RiverObservation => ({
    stationId, observedAt: new Date(0).toISOString(), retrievedAt: new Date().toISOString(),
    stageFt: null, dischargeCfs: null, status: 'SOURCE_UNAVAILABLE', provisional: false,
    sourceUri: '', cacheAgeSeconds,
  });

  if (!breaker.allow()) {
    const cached = await cache.read(stationId);
    if (cached && cacheAge(cached) <= maxCacheAgeSeconds) return { ...cached, status: 'STALE', cacheAgeSeconds: cacheAge(cached) };
    return unavailable();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const observation = await source.fetch(controller.signal);
    const validated = { ...observation, stageFt: finiteOrNull(observation.stageFt), dischargeCfs: finiteOrNull(observation.dischargeCfs) };
    breaker.success();
    const live: RiverObservation = { ...validated, stationId, status: 'LIVE', cacheAgeSeconds: 0 };
    await cache.write(live);
    return live;
  } catch {
    breaker.failure();
    const cached = await cache.read(stationId);
    if (cached && cacheAge(cached) <= maxCacheAgeSeconds) return { ...cached, status: 'STALE', cacheAgeSeconds: cacheAge(cached) };
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
}

function cacheAge(observation: RiverObservation): number {
  const age = (Date.now() - Date.parse(observation.observedAt)) / 1000;
  return Number.isFinite(age) && age >= 0 ? age : Number.POSITIVE_INFINITY;
}
