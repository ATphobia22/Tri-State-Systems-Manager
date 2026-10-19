/**
 * tiles-fetch-bridge.ts — LodScheduler → lifecycle → bandwidth → 3d-tiles-renderer.
 *
 * Per-frame:
 * 1. Scheduler produces load/evict plan
 * 2. TileResourceLifecycle bounds in-flight + ready bytes (no synthetic tiles)
 * 3. BandwidthAdaptiveFetchController adjusts concurrency / degrade steps
 * 4. Renderer LRU mark used/unused
 */

import type { TilesRenderer } from '3d-tiles-renderer';
import { BandwidthAdaptiveFetchController } from './bandwidth-adaptive-fetch';
import { LodScheduler, type LodCamera, type LodFetchPlan } from './lod-scheduler';
import { degradeWord } from './state-word-scheduler';
import { TileResourceLifecycle } from './tile-resource-lifecycle';

export interface BridgeBackpressureInfo {
  queuedItems: number;
  maxQueuedItems: number;
  suggestedDegradeSteps: number;
  bytesPerSec: number;
  adaptiveConcurrency: number;
}

export interface TilesFetchBridgeOptions {
  resolveTile?: (nodeId: string) => unknown;
  maxQueuedItems?: number;
  backpressureSteps?: number;
  onBackpressure?: (info: BridgeBackpressureInfo) => void;
  getStateWord?: () => number | null;
  onDegradedWord?: (word: number) => void;
  /** Optional external lifecycle (tests / shared caches). */
  lifecycle?: TileResourceLifecycle;
  /** Optional bandwidth controller. */
  bandwidth?: BandwidthAdaptiveFetchController;
}

export interface BridgeFrameStats {
  plan: LodFetchPlan;
  queuedItems: number;
  cachedBytes: number;
  loadProgress: number;
  backpressured: boolean;
  evictedTiles: number;
  lifecycleFetch: string[];
  lifecycleRelease: string[];
  adaptiveConcurrency: number;
  bytesPerSec: number;
}

export interface BridgeProgress {
  pendingTiles: number;
  cachedBytes: number;
  loadProgress: number;
  evictedTotal: number;
  adaptiveConcurrency: number;
  bytesPerSec: number;
}

export class TilesFetchBridge {
  private readonly renderer: TilesRenderer;
  private readonly scheduler: LodScheduler;
  private readonly resolveTile?: (nodeId: string) => unknown;
  private readonly maxQueuedItems: number;
  private readonly backpressureSteps: number;
  private readonly onBackpressure?: (info: BridgeBackpressureInfo) => void;
  private readonly getStateWord?: () => number | null;
  private readonly onDegradedWord?: (word: number) => void;
  private readonly lifecycle: TileResourceLifecycle;
  private readonly bandwidth: BandwidthAdaptiveFetchController;
  private evictedTotal = 0;
  private disposed = false;
  private lastCacheBytes = 0;
  private lastSampleAt = 0;

  constructor(renderer: TilesRenderer, scheduler: LodScheduler, options: TilesFetchBridgeOptions = {}) {
    if (!renderer) throw new Error('[TilesFetchBridge] renderer is required');
    if (!scheduler) throw new Error('[TilesFetchBridge] scheduler is required');
    const maxQueuedItems = options.maxQueuedItems ?? 24;
    if (!Number.isInteger(maxQueuedItems) || maxQueuedItems < 1) {
      throw new RangeError('maxQueuedItems must be a positive integer');
    }
    const backpressureSteps = options.backpressureSteps ?? 1;
    if (!Number.isInteger(backpressureSteps) || backpressureSteps < 0) {
      throw new RangeError('backpressureSteps must be a non-negative integer');
    }
    this.renderer = renderer;
    this.scheduler = scheduler;
    this.resolveTile = options.resolveTile;
    this.maxQueuedItems = maxQueuedItems;
    this.backpressureSteps = backpressureSteps;
    this.onBackpressure = options.onBackpressure;
    this.getStateWord = options.getStateWord;
    this.onDegradedWord = options.onDegradedWord;
    this.lifecycle = options.lifecycle ?? new TileResourceLifecycle({ maxInFlight: maxQueuedItems });
    this.bandwidth = options.bandwidth ?? new BandwidthAdaptiveFetchController();
  }

  update(camera: LodCamera): BridgeFrameStats {
    const empty: BridgeFrameStats = {
      plan: { load: [], evict: [], selected: [], transitions: [] },
      queuedItems: 0,
      cachedBytes: 0,
      loadProgress: 1,
      backpressured: false,
      evictedTiles: 0,
      lifecycleFetch: [],
      lifecycleRelease: [],
      adaptiveConcurrency: this.bandwidth.getConcurrency(),
      bytesPerSec: this.bandwidth.getBytesPerSec(),
    };
    if (this.disposed) return empty;

    const plan = this.scheduler.update(camera);
    const lifePlan = this.lifecycle.plan(plan.selected);
    let evictedTiles = 0;

    for (const id of lifePlan.toFetch) {
      this.lifecycle.markQueued(id);
    }
    for (const id of lifePlan.toRelease) {
      this.lifecycle.markReleased(id);
    }

    if (this.resolveTile) {
      const cache = this.renderer.lruCache;
      const loadCap = Math.min(plan.load.length, this.bandwidth.getConcurrency());
      for (let i = 0; i < loadCap; i++) {
        const nodeId = plan.load[i]!;
        this.lifecycle.markFetching(nodeId);
        const tile = this.resolveTile(nodeId);
        if (tile !== null && tile !== undefined && cache.has(tile)) cache.markUsed(tile);
      }
      for (const nodeId of plan.evict) {
        const tile = this.resolveTile(nodeId);
        if (tile !== null && tile !== undefined && cache.has(tile)) {
          cache.markUnused(tile);
          this.lifecycle.markReleased(nodeId);
          evictedTiles++;
        }
      }
      if (evictedTiles > 0) cache.unloadUnusedContent();
      this.evictedTotal += evictedTiles;
    }

    const queuedItems = this.pendingCount();
    const cachedBytes = this.cacheBytes();
    const now = Date.now();
    if (this.lastSampleAt > 0 && now > this.lastSampleAt) {
      const deltaBytes = Math.max(0, cachedBytes - this.lastCacheBytes);
      this.bandwidth.recordSample(deltaBytes, now - this.lastSampleAt, now);
    }
    this.lastCacheBytes = cachedBytes;
    this.lastSampleAt = now;

    const loadProgress = this.renderer.loadProgress;
    const adaptiveSteps = this.bandwidth.suggestedDegradeSteps();
    const queueBackpressure = queuedItems > this.maxQueuedItems;
    const backpressured = queueBackpressure || adaptiveSteps > 0;
    const steps = Math.max(this.backpressureSteps, adaptiveSteps);

    if (backpressured) {
      const word = this.getStateWord?.();
      if (word !== null && word !== undefined) {
        try {
          this.onDegradedWord?.(degradeWord(word, steps));
        } catch (error) {
          console.warn('[TilesFetchBridge] degradeWord failed:', error);
        }
      }
      this.onBackpressure?.({
        queuedItems,
        maxQueuedItems: this.maxQueuedItems,
        suggestedDegradeSteps: steps,
        bytesPerSec: this.bandwidth.getBytesPerSec(),
        adaptiveConcurrency: this.bandwidth.getConcurrency(),
      });
    }

    return {
      plan,
      queuedItems,
      cachedBytes,
      loadProgress,
      backpressured,
      evictedTiles,
      lifecycleFetch: lifePlan.toFetch,
      lifecycleRelease: lifePlan.toRelease,
      adaptiveConcurrency: this.bandwidth.getConcurrency(),
      bytesPerSec: this.bandwidth.getBytesPerSec(),
    };
  }

  getProgress(): BridgeProgress {
    if (this.disposed) {
      return {
        pendingTiles: 0,
        cachedBytes: 0,
        loadProgress: 1,
        evictedTotal: this.evictedTotal,
        adaptiveConcurrency: this.bandwidth.getConcurrency(),
        bytesPerSec: this.bandwidth.getBytesPerSec(),
      };
    }
    return {
      pendingTiles: this.pendingCount(),
      cachedBytes: this.cacheBytes(),
      loadProgress: this.renderer.loadProgress,
      evictedTotal: this.evictedTotal,
      adaptiveConcurrency: this.bandwidth.getConcurrency(),
      bytesPerSec: this.bandwidth.getBytesPerSec(),
    };
  }

  getLifecycle(): TileResourceLifecycle {
    return this.lifecycle;
  }

  getBandwidth(): BandwidthAdaptiveFetchController {
    return this.bandwidth;
  }

  reset(): void {
    this.scheduler.setLoaded([]);
  }

  dispose(): void {
    this.disposed = true;
  }

  private pendingCount(): number {
    const len = (q: object): number => {
      const items = (q as { items?: unknown }).items;
      return Array.isArray(items) ? items.length : 0;
    };
    const r = this.renderer;
    return len(r.downloadQueue) + len(r.parseQueue) + len(r.processNodeQueue);
  }

  private cacheBytes(): number {
    const v = (this.renderer.lruCache as unknown as { cachedBytes?: unknown }).cachedBytes;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
}
