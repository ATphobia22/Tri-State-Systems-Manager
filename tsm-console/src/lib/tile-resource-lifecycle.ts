/**
 * Tile resource lifecycle — status types + bounded fetch/release planning.
 *
 * Complements LodScheduler (selection) and tiles-fetch-bridge (renderer API).
 * Does not invent geometry: missing/failed tiles stay labeled, never synthetic.
 *
 * See docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md §3.
 */

export type TileResourceStatus =
  | 'idle'
  | 'queued'
  | 'fetching'
  | 'ready'
  | 'stale'
  | 'failed'
  | 'released';

export interface TileResourceRecord {
  id: string;
  status: TileResourceStatus;
  /** Estimated resident bytes when ready */
  bytes: number;
  lastError?: string;
  updatedAt: number;
}

export interface ResourceBudget {
  /** Max simultaneous in-flight fetches */
  maxInFlight: number;
  /** Soft memory budget in bytes for ready tiles */
  maxReadyBytes: number;
}

export interface LifecyclePlan {
  toFetch: string[];
  toRelease: string[];
  residentBytes: number;
  inFlight: number;
}

const DEFAULT_BUDGET: ResourceBudget = {
  maxInFlight: 8,
  maxReadyBytes: 256 * 1024 * 1024,
};

export class TileResourceLifecycle {
  private readonly resources = new Map<string, TileResourceRecord>();
  private readonly budget: ResourceBudget;

  constructor(budget: Partial<ResourceBudget> = {}) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    if (this.budget.maxInFlight < 1) throw new RangeError('maxInFlight must be >= 1');
    if (this.budget.maxReadyBytes < 1) throw new RangeError('maxReadyBytes must be >= 1');
  }

  get(id: string): TileResourceRecord | undefined {
    return this.resources.get(id);
  }

  /** Desired set from LOD scheduler selected ids. */
  plan(desiredIds: readonly string[], now = Date.now()): LifecyclePlan {
    const desired = new Set(desiredIds);
    let residentBytes = 0;
    let inFlight = 0;

    for (const rec of this.resources.values()) {
      if (rec.status === 'ready' || rec.status === 'stale') residentBytes += rec.bytes;
      if (rec.status === 'fetching' || rec.status === 'queued') inFlight += 1;
    }

    const toFetch: string[] = [];
    for (const id of desiredIds) {
      const rec = this.resources.get(id);
      if (!rec || rec.status === 'idle' || rec.status === 'released' || rec.status === 'failed') {
        if (toFetch.length + inFlight < this.budget.maxInFlight) {
          toFetch.push(id);
        }
      }
    }

    // Release non-desired ready/stale tiles, largest first, until under budget
    // or until only desired remain.
    const releasable = [...this.resources.values()]
      .filter((r) => (r.status === 'ready' || r.status === 'stale') && !desired.has(r.id))
      .sort((a, b) => b.bytes - a.bytes);

    const toRelease: string[] = [];
    let projected = residentBytes;
    for (const r of releasable) {
      if (projected <= this.budget.maxReadyBytes && toRelease.length === 0 && desired.size > 0) {
        // still release all non-desired to match selected set
      }
      toRelease.push(r.id);
      projected -= r.bytes;
    }

    // If still over budget with only desired residents, release least-recent desired (stale first)
    if (projected > this.budget.maxReadyBytes) {
      const victims = [...this.resources.values()]
        .filter((r) => r.status === 'ready' || r.status === 'stale')
        .filter((r) => !toRelease.includes(r.id))
        .sort((a, b) => a.updatedAt - b.updatedAt);
      for (const v of victims) {
        if (projected <= this.budget.maxReadyBytes) break;
        toRelease.push(v.id);
        projected -= v.bytes;
      }
    }

    return {
      toFetch,
      toRelease,
      residentBytes,
      inFlight,
    };
  }

  markQueued(id: string, now = Date.now()): void {
    this.resources.set(id, {
      id,
      status: 'queued',
      bytes: this.resources.get(id)?.bytes ?? 0,
      updatedAt: now,
    });
  }

  markFetching(id: string, now = Date.now()): void {
    const prev = this.resources.get(id);
    this.resources.set(id, {
      id,
      status: 'fetching',
      bytes: prev?.bytes ?? 0,
      updatedAt: now,
    });
  }

  markReady(id: string, bytes: number, now = Date.now()): void {
    if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError('bytes must be finite >= 0');
    this.resources.set(id, { id, status: 'ready', bytes, updatedAt: now });
  }

  markFailed(id: string, error: string, now = Date.now()): void {
    this.resources.set(id, {
      id,
      status: 'failed',
      bytes: 0,
      lastError: error,
      updatedAt: now,
    });
  }

  markReleased(id: string, now = Date.now()): void {
    const prev = this.resources.get(id);
    this.resources.set(id, {
      id,
      status: 'released',
      bytes: 0,
      lastError: prev?.lastError,
      updatedAt: now,
    });
  }

  /** Never synthesizes geometry for failed/missing tiles. */
  assertNotSynthetic(id: string): void {
    const rec = this.resources.get(id);
    if (!rec || rec.status === 'failed' || rec.status === 'released' || rec.status === 'idle') {
      throw new Error(
        `Tile ${id} is not ready (status=${rec?.status ?? 'missing'}) — do not invent geometry`,
      );
    }
  }
}
