/**
 * Resilient stage fetch — retries, last-known-good snapshots, auto-correct sentinels.
 * Per product direction: NOT fail-closed on gauges; prefer recovery.
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Auto-correct known bad numeric codes; clamp absurd magnitudes. */
export function autoCorrectStage(raw: number): { value: number; corrected: boolean; note?: string } {
  if (!Number.isFinite(raw) || SENTINELS.has(raw)) {
    return { value: Number.NaN, corrected: true, note: "sentinel_or_nonfinite" };
  }
  // Stage feet outside plausible river range for lower Wabash/Ohio → flag, keep value labeled
  if (raw < -5 || raw > 80) {
    return { value: raw, corrected: true, note: "out_of_plausible_range" };
  }
  return { value: raw, corrected: false };
}

export type FetchStageFn = (siteId: string) => Promise<{ stageFt: number; observedAt: string; source: StageSource }>;

export interface ResilientStageOptions {
  fetchers: readonly FetchStageFn[];
  getSnapshot?: (siteId: string) => StageSnapshot | null;
  saveSnapshot?: (snap: StageSnapshot) => void;
  maxRetries?: number;
}

/**
 * Try fetchers in order with exponential backoff. On success, snapshot LKG.
 * If all fail, return LKG snapshot if present (stale). Never hard-fail empty.
 */
export async function fetchStageResilient(
  siteId: string,
  opts: ResilientStageOptions,
): Promise<StageReading> {
  const retries = opts.maxRetries ?? MAX_RETRIES;
  const errors: string[] = [];

  for (const fetch of opts.fetchers) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const raw = await fetch(siteId);
        const { value, corrected, note } = autoCorrectStage(raw.stageFt);
        if (!Number.isFinite(value)) {
          errors.push(`${raw.source}:bad_value`);
          break; // next fetcher
        }
        const reading: StageReading = {
          siteId,
          stageFt: value,
          observedAt: raw.observedAt,
          source: raw.source,
          quality: corrected ? "corrected" : "ok",
          notes: note,
        };
        opts.saveSnapshot?.({
          siteId,
          reading,
          savedAt: new Date().toISOString(),
        });
        return reading;
      } catch (e) {
        errors.push(String(e));
        await sleep(BASE_MS * 2 ** attempt);
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

  // Soft empty — estimated placeholder so UI can still render; labeled
  return {
    siteId,
    stageFt: Number.NaN,
    observedAt: new Date().toISOString(),
    source: "lkg_snapshot",
    quality: "estimated",
    notes: `no_lkg;errors:${errors.slice(0, 5).join(";")}`,
  };
}

export const RESILIENT_STAGE_VERSION = "1.0.0" as const;
