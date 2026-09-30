/**
 * live-data-fallback.test.ts — the real-time/fallback contract
 * (world/live-data.ts): live tiles when the endpoint answers, the bundled
 * 3DEP-derived grid when it does not, procedural as the last resort.
 * Network is fully mocked; nothing here touches a real service.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeTerrariumRgba,
  TerrainTileClient,
  mosaicToGrid,
  resolveTerrainWithFallback,
  LiveDataManager,
  TILE_PX,
  type LiveDataSnapshot,
  type TerrainTile,
} from '../src/lib/flood-sim/world/live-data';

// Encodes ≈360 ft: elev_m = 128*256 + 109 + 187/256 − 32768 ≈ 109.73 m.
const R = 128;
const G = 109;
const B = 187;

function constantRgba(): Uint8ClampedArray {
  const px = TILE_PX * TILE_PX;
  const out = new Uint8ClampedArray(px * 4);
  for (let i = 0; i < px; i += 1) {
    out[i * 4] = R;
    out[i * 4 + 1] = G;
    out[i * 4 + 2] = B;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/** Injected decoder: no canvas, no network — bytes are ignored. */
const rgbaLoader = async (): Promise<{ rgba: Uint8ClampedArray; w: number; h: number }> => ({
  rgba: constantRgba(),
  w: TILE_PX,
  h: TILE_PX,
});

const clientOpts = { loadRgba: rgbaLoader, maxRetries: 0, timeoutMs: 50 };

describe('decodeTerrariumRgba', () => {
  it('decodes the Terrarium encoding to feet', () => {
    expect(decodeTerrariumRgba(new Uint8ClampedArray([128, 0, 0, 255]), 1)[0]).toBeCloseTo(0, 6);
    expect(decodeTerrariumRgba(new Uint8ClampedArray([128, 1, 0, 255]), 1)[0]).toBeCloseTo(
      3.28084,
      4,
    );
    expect(decodeTerrariumRgba(new Uint8ClampedArray([0, 0, 0, 255]), 1)[0]).toBeCloseTo(
      -32768 * 3.28084,
      0,
    );
  });

  it('throws on short buffers', () => {
    expect(() => decodeTerrariumRgba(new Uint8ClampedArray(3), 1)).toThrow();
  });
});

describe('TerrainTileClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('caches tiles and reports LIVE after a success', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    const t1 = await client.getTile(13, 2093, 3164);
    expect(t1.fromCache).toBe(false);
    expect(t1.elevFt.length).toBe(TILE_PX * TILE_PX);
    expect(t1.elevFt[0]).toBeCloseTo(360, 0);
    const t2 = await client.getTile(13, 2093, 3164);
    expect(t2.fromCache).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const snap = client.endpointSnapshot();
    expect(snap.status).toBe('LIVE');
    expect(snap.asOfIso).not.toBeNull();
    expect(snap.ageSec).not.toBeNull();
  });

  it('reports SOURCE_UNAVAILABLE when the endpoint never answers', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    await expect(client.getTile(13, 2093, 3164)).rejects.toThrow();
    const snap = client.endpointSnapshot();
    expect(snap.status).toBe('SOURCE_UNAVAILABLE');
    expect(snap.asOfIso).toBeNull();
    expect(snap.ageSec).toBeNull();
  });

  it('reports STALE when cached tiles outlive a failed probe', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(new ArrayBuffer(8)));
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    await client.getTile(13, 2093, 3164); // warms cache, records lastOk
    fetchMock.mockRejectedValue(new Error('went away'));
    expect(await client.probe(13, 2094, 3164)).toBe(false);
    const snap = client.endpointSnapshot();
    expect(snap.status).toBe('STALE');
    expect(snap.asOfIso).not.toBeNull();
  });

  it('retries a flaky endpoint then succeeds', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue(new Response(new ArrayBuffer(8)));
    const client = new TerrainTileClient('https://tiles.example/t', {
      ...clientOpts,
      maxRetries: 1,
    });
    const tile = await client.getTile(13, 2093, 3164);
    expect(tile.fromCache).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('mosaicToGrid', () => {
  function blockTiles(): TerrainTile[] {
    const tiles: TerrainTile[] = [];
    for (let y = 3163; y <= 3165; y += 1) {
      for (let x = 2092; x <= 2094; x += 1) {
        tiles.push({
          z: 13,
          x,
          y,
          elevFt: new Float64Array(TILE_PX * TILE_PX).fill(360),
          fromCache: false,
        });
      }
    }
    return tiles;
  }

  it('resamples a constant tile field onto the domain grid', () => {
    const grid = mosaicToGrid(blockTiles(), 13, 8, 8, 200, 37.845887, -88.005075);
    expect(grid.length).toBe(8);
    expect(grid[0].length).toBe(8);
    for (const row of grid) {
      for (const v of row) expect(v).toBeCloseTo(360, 6);
    }
  });

  it('throws when the mosaic is empty', () => {
    expect(() => mosaicToGrid([], 13, 8, 8, 200, 37.845887, -88.005075)).toThrow();
  });
});

describe('resolveTerrainWithFallback', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const base = {
    anchorLat: 37.845887,
    anchorLon: -88.005075,
    nx: 16,
    ny: 16,
    dxFt: 200,
    seed: 7,
    baseElevFt: 375,
    valleyReliefFt: 8,
    noiseAmplitudeFt: 2,
  };

  it('uses live tiles when the endpoint answers', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new ArrayBuffer(8)));
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    const r = await resolveTerrainWithFallback({ client, ...base, halfExtentDeg: 0.01 });
    expect(r.tier).toBe('live');
    expect(r.status).toBe('LIVE');
    expect(r.asOfIso).not.toBeNull();
    expect(r.grid.length).toBe(16);
    for (const row of r.grid) {
      for (const v of row) expect(v).toBeCloseTo(360, 0);
    }
  });

  it('falls back to the bundled source-derived grid when the endpoint is down', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    const r = await resolveTerrainWithFallback({ client, ...base });
    expect(r.tier).toBe('bundled-source-derived');
    expect(r.status).toBe('STALE');
    expect(r.provenance).toContain('3DEP-derived');
    expect(r.provenance).toContain('live endpoint unreachable');
    expect(r.sourceDerived).not.toBeNull();
  });

  it('never synthesizes procedural terrain, even when asked', async () => {
    // 'procedural' was removed from TerrainSourcePreference on 2026-09-29:
    // procedural terrain must never stand in as evidence. A stale caller
    // passing it degrades to the fail-closed chain (live -> source-derived
    // -> throw), never to synthesis.
    const fetchMock = vi.mocked(fetch);
    const client = new TerrainTileClient('https://tiles.example/t', clientOpts);
    const r = await resolveTerrainWithFallback({
      client,
      ...base,
      terrainSource: 'procedural' as 'auto',
    });
    expect(r.tier).not.toBe('procedural');
    expect(r.provenance).not.toContain('procedural approximation');
  });
});

describe('LiveDataManager', () => {
  it('emits an initial snapshot without starting network polling', () => {
    const manager = new LiveDataManager({ tileClientOptions: clientOpts });
    const seen: LiveDataSnapshot[] = [];
    const unsubscribe = manager.subscribe((s) => seen.push(s));
    expect(seen.length).toBe(1);
    expect(seen[0].terrainEndpoint.status).toBe('SOURCE_UNAVAILABLE');
    expect(seen[0].gauges).toEqual({});
    expect(seen[0].updatedIso).toBeTruthy();
    expect(manager.isRunning).toBe(false);
    unsubscribe();
    manager.stop();
  });
});
