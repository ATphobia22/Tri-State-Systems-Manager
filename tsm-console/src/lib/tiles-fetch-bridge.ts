/**
 * tiles-fetch-bridge.ts — connects LodScheduler → 3d-tiles-renderer → state-word scheduler.
 *
 * Three existing pieces, one bridge:
 *   scheduler decides  (LodScheduler.update -> LodFetchPlan: load / evict)
 *   bridge translates   (this module: plan -> renderer cache/queue operations)
 *   renderer fetches    (nasa-ammos/3d-tiles-renderer TilesRenderer: its own
 *                        download/parse queues and LRU cache do the real work)
 *
 * Per-frame responsibilities:
 * 1. Run the scheduler for the camera and get the fetch plan.
 * 2. Translate: mark loaded tiles used, mark evicted tiles unused and run an
 *    LRU pass so memory frees promptly (the renderer's own update() still
 *    owns actual downloading and rendering).
 * 3. Backpressure: measure queued (download + parse + process) items against
 *    a cap; when overfull, suggest a degraded state word via degradeWord()
 *    from the state-word scheduler so the 5D pipeline sheds detail instead
 *    of stalling.
 * 4. Progress: expose pending/bytes/load-progress for UI.
 *
 * The bridge never calls renderer.update() — the host layer owns the render
 * loop. Node-id -> tile mapping is caller-supplied because the scheduler's
 * Transvoxel octree nodes and the tileset's tiles are different tile systems;
 * the default mapping is identity (node id == tile key lookup skipped).
 */

import type { TilesRenderer } from '3d-tiles-renderer';
import { LodScheduler, type LodCamera, type LodFetchPlan } from './lod-scheduler';
import { degradeWord } from './state-word-scheduler';

export interface BridgeBackpressureInfo {
  queuedItems: number;
  maxQueuedItems: number;
  suggestedDegradeSteps: number;
}

export interface TilesFetchBridgeOptions {
  /**
   * Map a scheduler node id to the renderer's tile object (or null when the
   * node has no corresponding tile). When omitted, no per-tile cache
   * operations are performed — the bridge still reports plans, progress and
   * backpressure.
   */
  resolveTile?: (nodeId: string) => unknown;
  /** Queued-item cap before backpressure fires. Default 24. */
  maxQueuedItems?: number;
  /** degradeWord steps suggested under backpressure. Default 1. */
  backpressureSteps?: number;
  /** Called when the fetch queue is overfull. */
  onBackpressure?: (info: BridgeBackpressureInfo) => void;
  /** Supplies the current representative state word for degradation. */
  getStateWord?: () => number | null;
  /** Receives the degraded word suggestion (caller applies it). */
  onDegradedWord?: (word: number) => void;
}

export interface BridgeFrameStats {
  plan: LodFetchPlan;
  queuedItems: number;
  cachedBytes: number;
  loadProgress: number;
  backpressured: boolean;
  /** Tiles marked unused this frame (eviction hints applied). */
  evictedTiles: number;
}

export interface BridgeProgress {
  pendingTiles: number;
  cachedBytes: number;
  loadProgress: number;
  evictedTotal: number;
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
  private evictedTotal = 0;
  private disposed = false;

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
  }

  /**
   * Run one bridge pass for the camera. Safe to call every frame; cheap when
   * the plan is empty and no resolver is configured.
   */
  update(camera: LodCamera): BridgeFrameStats {
    const empty: BridgeFrameStats = {
      plan: { load: [], evict: [], selected: [], transitions: [] },
      queuedItems: 0,
      cachedBytes: 0,
      loadProgress: 1,
      backpressured: false,
      evictedTiles: 0,
    };
    if (this.disposed) return empty;

    const plan = this.scheduler.update(camera);
    let evictedTiles = 0;

    if (this.resolveTile) {
      const cache = this.renderer.lruCache;
      for (const nodeId of plan.load) {
        const tile = this.resolveTile(nodeId);
        // Keep freshly selected tiles resident; the renderer's own update()
        // already marks visible tiles used — this is a no-op safety net.
        if (tile !== null && tile !== undefined && cache.has(tile)) cache.markUsed(tile);
      }
      for (const nodeId of plan.evict) {
        const tile = this.resolveTile(nodeId);
        if (tile !== null && tile !== undefined && cache.has(tile)) {
          cache.markUnused(tile);
          evictedTiles++;
        }
      }
      if (evictedTiles > 0) cache.unloadUnusedContent();
      this.evictedTotal += evictedTiles;
    }

    const queuedItems = this.pendingCount();
    const cachedBytes = this.cacheBytes();
    const loadProgress = this.renderer.loadProgress;
    const backpressured = queuedItems > this.maxQueuedItems;

    if (backpressured) {
      // Shed detail instead of stalling: suggest a degraded state word.
      const word = this.getStateWord?.();
      if (word !== null && word !== undefined) {
        try {
          this.onDegradedWord?.(degradeWord(word, this.backpressureSteps));
        } catch (error) {
          console.warn('[TilesFetchBridge] degradeWord failed:', error);
        }
      }
      this.onBackpressure?.({
        queuedItems,
        maxQueuedItems: this.maxQueuedItems,
        suggestedDegradeSteps: this.backpressureSteps,
      });
    }

    return { plan, queuedItems, cachedBytes, loadProgress, backpressured, evictedTiles };
  }

  /** UI-facing progress snapshot. */
  getProgress(): BridgeProgress {
    if (this.disposed) {
      return { pendingTiles: 0, cachedBytes: 0, loadProgress: 1, evictedTotal: this.evictedTotal };
    }
    return {
      pendingTiles: this.pendingCount(),
      cachedBytes: this.cacheBytes(),
      loadProgress: this.renderer.loadProgress,
      evictedTotal: this.evictedTotal,
    };
  }

  /** Reset the scheduler's loaded set (e.g. after a cache clear). */
  reset(): void {
    this.scheduler.setLoaded([]);
  }

  dispose(): void {
    this.disposed = true;
  }

  private pendingCount(): number {    // PriorityQueue exposes `items` in JS (absent from the .d.ts); fall back
    // to 0 rather than crashing if the shape ever changes.
    const len = (q: object): number => {
      const items = (q as { items?: unknown }).items;
      return Array.isArray(items) ? items.length : 0;
    };
    const r = this.renderer;
    return len(r.downloadQueue) + len(r.parseQueue) + len(r.processNodeQueue);
  }

  private cacheBytes(): number {
    // LRUCache tracks cachedBytes in JS (absent from the .d.ts).
    const v = (this.renderer.lruCache as unknown as { cachedBytes?: unknown }).cachedBytes;
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
}
