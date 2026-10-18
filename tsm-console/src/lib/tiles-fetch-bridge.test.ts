/**
 * Tests for tiles-fetch-bridge.ts.
 * Fake renderer + fake scheduler; no GL, no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { TilesRenderer } from '3d-tiles-renderer';
import { TilesFetchBridge } from '../lib/tiles-fetch-bridge';
import type { LodCamera, LodFetchPlan, LodScheduler } from '../lib/lod-scheduler';
import { decodeStateWord } from '../lib/state-word-codec';

function makeRenderer(overrides: Record<string, unknown> = {}): TilesRenderer {
  const cache = {
    _used: new Set<unknown>(),
    has: vi.fn((_i: unknown) => true),
    markUsed: vi.fn((i: unknown) => { cache._used.add(i); }),
    markUnused: vi.fn((i: unknown) => { cache._used.delete(i); }),
    unloadUnusedContent: vi.fn(() => {}),
    cachedBytes: 4096,
  };
  return {
    lruCache: cache,
    downloadQueue: { items: [] as unknown[] },
    parseQueue: { items: [] as unknown[] },
    processNodeQueue: { items: [] as unknown[] },
    loadProgress: 0.75,
    ...overrides,
  } as unknown as TilesRenderer;
}

function makeScheduler(plan: LodFetchPlan): LodScheduler {
  return {
    update: vi.fn(() => plan),
    setLoaded: vi.fn(() => {}),
    getLoaded: () => [],
  } as unknown as LodScheduler;
}

const camera: LodCamera = { position: [0, 0, 100], fovDeg: 60, screenHeightPx: 800 };
const plan: LodFetchPlan = { load: ['n1', 'n2'], evict: ['n0'], selected: ['n1', 'n2'], transitions: [] };

describe('TilesFetchBridge', () => {
  it('translates load/evict plans into cache operations', () => {
    const renderer = makeRenderer();
    const scheduler = makeScheduler(plan);
    const tiles: Record<string, object> = { n0: { k: 't0' }, n1: { k: 't1' }, n2: { k: 't2' } };
    const bridge = new TilesFetchBridge(renderer, scheduler, {
      resolveTile: (id) => tiles[id] ?? null,
    });
    const stats = bridge.update(camera);

    expect(stats.plan).toBe(plan);
    const cache = renderer.lruCache as unknown as {
      markUsed: ReturnType<typeof vi.fn>;
      markUnused: ReturnType<typeof vi.fn>;
      unloadUnusedContent: ReturnType<typeof vi.fn>;
    };
    expect(cache.markUsed).toHaveBeenCalledWith(tiles.n1);
    expect(cache.markUsed).toHaveBeenCalledWith(tiles.n2);
    expect(cache.markUnused).toHaveBeenCalledWith(tiles.n0);
    expect(cache.unloadUnusedContent).toHaveBeenCalledTimes(1);
    expect(stats.evictedTiles).toBe(1);
    expect(stats.queuedItems).toBe(0);
    expect(stats.cachedBytes).toBe(4096);
    expect(stats.loadProgress).toBe(0.75);
    expect(stats.backpressured).toBe(false);
  });

  it('skips per-tile work when no resolver is configured', () => {
    const renderer = makeRenderer();
    const scheduler = makeScheduler(plan);
    const bridge = new TilesFetchBridge(renderer, scheduler);
    const stats = bridge.update(camera);
    expect(stats.plan).toBe(plan);
    expect(stats.evictedTiles).toBe(0);
    const cache = renderer.lruCache as unknown as { unloadUnusedContent: ReturnType<typeof vi.fn> };
    expect(cache.unloadUnusedContent).not.toHaveBeenCalled();
  });

  it('fires backpressure and suggests a degraded word when the queue is full', () => {
    const renderer = makeRenderer({
      downloadQueue: { items: new Array(20).fill({}) },
      parseQueue: { items: new Array(10).fill({}) },
    });
    const scheduler = makeScheduler({ load: [], evict: [], selected: [], transitions: [] });
    const onBackpressure = vi.fn();
    const onDegradedWord = vi.fn();
    // Word with T=3 (bits 6-8): degradation should strip texture first.
    const word = 0b00_00_000_011_000_000; // B=0 D=0 C=0 T=3 S=0
    const bridge = new TilesFetchBridge(renderer, scheduler, {
      maxQueuedItems: 24,
      backpressureSteps: 1,
      onBackpressure,
      getStateWord: () => word,
      onDegradedWord,
    });
    const stats = bridge.update(camera);
    expect(stats.backpressured).toBe(true);
    expect(stats.queuedItems).toBe(30);
    expect(onBackpressure).toHaveBeenCalledTimes(1);
    expect(onBackpressure.mock.calls[0][0]).toMatchObject({
      queuedItems: 30,
      maxQueuedItems: 24,
      suggestedDegradeSteps: 1,
    });
    expect(onDegradedWord).toHaveBeenCalledTimes(1);
    const degraded: number = onDegradedWord.mock.calls[0][0];
    expect(decodeStateWord(degraded, 'T')).toBe(2); // T stripped 3 -> 2
    expect(decodeStateWord(degraded, 'D')).toBe(0); // D untouched
  });

  it('no backpressure at or under the cap', () => {
    const renderer = makeRenderer({
      downloadQueue: { items: new Array(24).fill({}) },
    });
    const scheduler = makeScheduler({ load: [], evict: [], selected: [], transitions: [] });
    const onBackpressure = vi.fn();
    const bridge = new TilesFetchBridge(renderer, scheduler, { maxQueuedItems: 24, onBackpressure });
    const stats = bridge.update(camera);
    expect(stats.backpressured).toBe(false);
    expect(onBackpressure).not.toHaveBeenCalled();
  });

  it('getProgress reports a UI snapshot', () => {
    const renderer = makeRenderer({
      downloadQueue: { items: new Array(3).fill({}) },
      parseQueue: { items: new Array(2).fill({}) },
    });
    const scheduler = makeScheduler(plan);
    const tiles: Record<string, object> = { n0: { k: 't0' } };
    const bridge = new TilesFetchBridge(renderer, scheduler, {
      resolveTile: (id) => tiles[id] ?? null,
    });
    bridge.update(camera); // evicts n0 -> evictedTotal 1
    const p = bridge.getProgress();
    expect(p.pendingTiles).toBe(5);
    expect(p.cachedBytes).toBe(4096);
    expect(p.loadProgress).toBe(0.75);
    expect(p.evictedTotal).toBe(1);
  });

  it('reset() clears the scheduler loaded set; dispose() freezes output', () => {
    const renderer = makeRenderer();
    const scheduler = makeScheduler(plan);
    const bridge = new TilesFetchBridge(renderer, scheduler);
    bridge.reset();
    expect(scheduler.setLoaded).toHaveBeenCalledWith([]);
    bridge.dispose();
    const stats = bridge.update(camera);
    expect(stats.plan.load).toEqual([]);
    expect(stats.loadProgress).toBe(1);
  });

  it('rejects bad constructor arguments', () => {
    const renderer = makeRenderer();
    const scheduler = makeScheduler(plan);
    expect(() => new TilesFetchBridge(null as unknown as TilesRenderer, scheduler)).toThrow(/renderer/);
    expect(() => new TilesFetchBridge(renderer, null as unknown as LodScheduler)).toThrow(/scheduler/);
    expect(() => new TilesFetchBridge(renderer, scheduler, { maxQueuedItems: 0 })).toThrow(RangeError);
  });
});
