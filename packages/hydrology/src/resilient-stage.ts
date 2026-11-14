/**
 * Resilient stage fetch — full-jitter backoff, circuit breaker, LKG snapshots, sentinel auto-correct.
 * Prefer recovery over fail-closed.
 */

export type StageSource = "usgs_ogc" | "nwps" | "lkg_snapshot" | "community";

export interface StageReading {
  readonly siteId: string;
  readonly stageFt: number;
  readonly observedAt: string;
  readonly source: StageSource;
  readonly quality: "ok" | "corrected" | "stale" | "estimated";
  readonly notes?: string;
}

export interface StageSnapshot {
  readonly siteId: string;
  readonly reading: StageReading;
  readonly savedAt: string;
}

const SENTINELS = new Set([-999, -9999, 999, 9999]);
const MAX_RETRIES = 4;
const BASE_MS = 250;
const MAX_BACKOFF_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Full jitter: uniform random in [0, min(cap, BASE * 2^attempt)]. */
export function fullJitterDelayMs(attempt: number, baseMs = BASE_MS, capMs = MAX_BACKOFF_MS): number {
  const exp = Math.min(capMs, baseMs * 2 ** attempt);
  return Math.floor(Math.random() * (exp + 1));
}

export function autoCorrectStage(raw: number): { value: number; corrected: boolean; note?: string } {
  if (!Number.isFinite(raw) || SENTINELS.has(raw)) {
    return { value: Number.NaN, corrected: true, note: "sentinel_or_nonfinite" };
  }
  if (raw < -5 || raw > 80) {
    return { value: raw, corrected: true, note: "out_of_plausible_range" };
  }
  return { value: raw, corrected: false };
}

/** Simple per-source circuit breaker. */
export type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = "closed";
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly coolDownMs = 30_000,
  ) {}

  getStatus(): CircuitState {
    if (this.state === "open" && Date.now() - this.openedAt >= this.coolDownMs) {
      this.state = "half_open";
    }
    return this.state;
  }

  allow(): boolean {
    const s = this.getStatus();
    return s === "closed" || s === "half_open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}

export type FetchStageFn = (siteId: string) => Promise<{ stageFt: number; observedAt: string; source: StageSource }>;

export interface ResilientStageOptions {
  fetchers: readonly FetchStageFn[];
  getSnapshot?: (siteId: string) => StageSnapshot | null;
  saveSnapshot?: (snap: StageSnapshot) => void;
  maxRetries?: number;
  /** Optional breakers keyed by fetcher index or source label */
  breakers?: readonly CircuitBreaker[];
  useFullJitter?: boolean;
}

export async function fetchStageResilient(
  siteId: string,
  opts: ResilientStageOptions,
): Promise<StageReading> {
  const retries = opts.maxRetries ?? MAX_RETRIES;
  const jitter = opts.useFullJitter !== false;
  const errors: string[] = [];

  for (let fi = 0; fi < opts.fetchers.length; fi++) {
    const fetch = opts.fetchers[fi];
    const breaker = opts.breakers?.[fi];
    if (breaker && !breaker.allow()) {
      errors.push(`breaker_open:${fi}`);
      continue;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const raw = await fetch(siteId);
        const { value, corrected, note } = autoCorrectStage(raw.stageFt);
        if (!Number.isFinite(value)) {
          errors.push(`${raw.source}:bad_value`);
          breaker?.recordFailure();
          break;
        }
        const reading: StageReading = {
          siteId,
          stageFt: value,
          observedAt: raw.observedAt,
          source: raw.source,
          quality: corrected ? "corrected" : "ok",
          notes: note,
        };
        breaker?.recordSuccess();
        opts.saveSnapshot?.({
          siteId,
          reading,
          savedAt: new Date().toISOString(),
        });
        return reading;
      } catch (e) {
        errors.push(String(e));
        breaker?.recordFailure();
        const delay = jitter ? fullJitterDelayMs(attempt) : Math.min(MAX_BACKOFF_MS, BASE_MS * 2 ** attempt);
        await sleep(delay);
      }
    }
  }

  const lkg = opts.getSnapshot?.(siteId);
  if (lkg) {
    return {
      ...lkg.reading,
      source: "lkg_snapshot",
      quality: "stale",
      notes: `fallback_after:${errors.slice(0, 3).join(";")}`,
    };
  }

  return {
    siteId,
    stageFt: Number.NaN,
    observedAt: new Date().toISOString(),
    source: "lkg_snapshot",
    quality: "estimated",
    notes: `no_lkg;errors:${errors.slice(0, 5).join(";")}`,
  };
}

export const RESILIENT_STAGE_VERSION = "1.1.0" as const;
