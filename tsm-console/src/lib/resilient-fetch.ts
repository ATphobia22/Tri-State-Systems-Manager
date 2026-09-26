/**
 * Browser-side resilient fetch for TSM public observation planes.
 * Timeout + exponential backoff + circuit breaker + last-known-good (localStorage).
 * Never elevates cache to regulatory authority — LKG is operational continuity only.
 */

export interface ResilientFetchOptions {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  circuitFailureThreshold?: number;
  circuitOpenMs?: number;
  lkgKey?: string;
  cache?: RequestCache;
  headers?: HeadersInit;
}

export interface ResilientResult<T> {
  ok: boolean;
  data: T | null;
  source: 'network' | 'lkg' | 'none';
  status?: number;
  error?: string;
  retrievedAt: string;
}

const circuitState = new Map<string, { failures: number; openedAt: number | null }>();

function circuitKey(url: string): string {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

function isCircuitOpen(key: string, openMs: number): boolean {
  const state = circuitState.get(key);
  if (!state?.openedAt) return false;
  if (Date.now() - state.openedAt < openMs) return true;
  state.openedAt = null;
  state.failures = 0;
  return false;
}

function recordFailure(key: string, threshold: number, openMs: number): void {
  const state = circuitState.get(key) ?? { failures: 0, openedAt: null };
  state.failures += 1;
  if (state.failures >= threshold) state.openedAt = Date.now();
  circuitState.set(key, state);
  void openMs;
}

function recordSuccess(key: string): void {
  circuitState.set(key, { failures: 0, openedAt: null });
}

function readLkg<T>(key: string | undefined): T | null {
  if (!key || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLkg(key: string | undefined, data: unknown): void {
  if (!key || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), data }));
  } catch {
    /* quota / private mode */
  }
}

export async function resilientFetchJson<T>(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<ResilientResult<T>> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const retries = options.retries ?? 2;
  const backoffMs = options.backoffMs ?? 400;
  const threshold = options.circuitFailureThreshold ?? 4;
  const openMs = options.circuitOpenMs ?? 30_000;
  const key = circuitKey(url);
  const retrievedAt = new Date().toISOString();

  if (isCircuitOpen(key, openMs)) {
    const lkg = readLkg<{ savedAt: string; data: T }>(options.lkgKey);
    return {
      ok: false,
      data: lkg?.data ?? null,
      source: lkg ? 'lkg' : 'none',
      error: 'circuit_open',
      retrievedAt,
    };
  }

  let lastError = 'unknown';
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(options.headers || {}) },
        cache: options.cache ?? 'no-store',
      });
      clearTimeout(timer);
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        recordFailure(key, threshold, openMs);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
          continue;
        }
        break;
      }
      const data = (await response.json()) as T;
      recordSuccess(key);
      writeLkg(options.lkgKey, data);
      return { ok: true, data, source: 'network', status: response.status, retrievedAt };
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error.message : String(error);
      recordFailure(key, threshold, openMs);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs * 2 ** attempt));
      }
    }
  }

  const lkg = readLkg<{ savedAt: string; data: T }>(options.lkgKey);
  return {
    ok: false,
    data: lkg?.data ?? null,
    source: lkg ? 'lkg' : 'none',
    error: lastError,
    retrievedAt,
  };
}
