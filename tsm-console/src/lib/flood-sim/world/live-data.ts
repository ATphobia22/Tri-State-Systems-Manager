/**
 * world/live-data.ts — genuinely real-time data with a reliable fallback chain.
 *
 * The map stays live through plain HTTPS polling (the repo forbids streaming
 * transports in the simulator; see the transport gate test): gauges poll on an
 * interval, and the terrain endpoint is health-probed on an interval with an
 * in-memory tile cache. When a service is unreachable, the module degrades
 * along an explicit, labeled chain instead of failing:
 *
 *   terrain:  live tiles → bundled 3DEP-derived grid → procedural approximation
 *   gauges:   live observation → last-good (STALE) → SOURCE_UNAVAILABLE
 *
 * Every snapshot carries one of the repo's provenance-taxonomy labels —
 * LIVE, STALE, SOURCE_UNAVAILABLE, CANDIDATE_NOT_LIVE — plus the timestamp of
 * the last good read, so the UI can always say *what* the user is looking at
 * and *how old* it is. Nothing here invents data: a missing source is
 * reported, never interpolated.
 */

import { startGaugePoll, type RiverGaugeObservation } from '../../river-gauges';
import { resolveElevationGrid, type ResolvedTerrainSource } from './terrain';

/** Status vocabulary shared with the repo's provenance taxonomy. */
export type LiveStatus = 'LIVE' | 'STALE' | 'SOURCE_UNAVAILABLE' | 'CANDIDATE_NOT_LIVE';

export interface SourceSnapshot {
  status: LiveStatus;
  /** ISO timestamp of the last successful read, or null if never. */
  asOfIso: string | null;
  /** Seconds since the last successful read, or null if never. */
  ageSec: number | null;
  /** Short human label for status badges. */
  detail: string;
}

export interface LiveDataSnapshot {
  terrainEndpoint: SourceSnapshot;
  gauges: Record<string, SourceSnapshot & { value: number | null; unit: string | null }>;
  updatedIso: string;
}

/** HTTPS GET with a hard timeout. Rejects on timeout, network error, or HTTP >= 400. */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`[live-data] HTTP ${res.status} for ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// --- Terrarium tiles ----------------------------------------------------------

export const TERRARIUM_BASE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
export const TILE_PX = 256;
const FT_PER_M = 3.28084;

export function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z;
}
export function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}
export function tileXToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}
export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/**
 * Decode Terrarium RGBA bytes to elevation in feet.
 * elev_m = R*256 + G + B/256 − 32768 (Mapzen Terrarium encoding).
 * Pure — unit-testable without a network or a canvas.
 */
export function decodeTerrariumRgba(rgba: Uint8Array | Uint8ClampedArray, pixelCount: number): Float64Array {
  if (rgba.length < pixelCount * 4) {
    throw new Error('[live-data] RGBA buffer smaller than pixelCount*4');
  }
  const out = new Float64Array(pixelCount);
  for (let i = 0; i < pixelCount; i += 1) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    out[i] = (r * 256 + g + b / 256 - 32768) * FT_PER_M;
  }
  return out;
}

export interface RgbaImage {
  rgba: Uint8ClampedArray;
  w: number;
  h: number;
}

/** Browser-only RGBA extraction (canvas). Node/test callers inject `loadRgba`. */
async function browserRgbaFromBlob(blob: Blob): Promise<RgbaImage> {
  if (typeof createImageBitmap === 'undefined' || typeof document === 'undefined') {
    throw new Error('[live-data] no bitmap decoder in this environment — inject loadRgba');
  }
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[live-data] 2d canvas context unavailable');
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
  if (typeof bmp.close === 'function') bmp.close();
  return { rgba: data.data, w: bmp.width, h: bmp.height };
}

export interface TerrainTile {
  z: number;
  x: number;
  y: number;
  /** Elevation in feet, row-major, TILE_PX × TILE_PX. */
  elevFt: Float64Array;
  fromCache: boolean;
}

export interface TerrainTileClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  cacheSize?: number;
  loadRgba?: (bytes: ArrayBuffer) => Promise<RgbaImage>;
}

/**
 * Tile client with an in-memory LRU cache, per-request timeouts, and bounded
 * retries. A failed fetch never poisons the cache: the last good tile keeps
 * serving while the endpoint snapshot reports STALE.
 */
export class TerrainTileClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly cacheSize: number;
  private readonly loadRgba: (bytes: ArrayBuffer) => Promise<RgbaImage>;
  private readonly cache = new Map<string, TerrainTile>();
  private lastOkAt: number | null = null;
  private lastFailAt: number | null = null;
  private lastFailDetail = '';
  // Monotonic event ordering: wall-clock ties must not mask a failure that
  // program-ordered after a success.
  private eventSeq = 0;
  private lastOkSeq = -1;
  private lastFailSeq = -1;

  constructor(baseUrl: string = TERRARIUM_BASE_URL, opts: TerrainTileClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 8000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.cacheSize = opts.cacheSize ?? 64;
    this.loadRgba = opts.loadRgba ?? (async (bytes) => browserRgbaFromBlob(new Blob([bytes])));
  }

  tileUrl(z: number, x: number, y: number): string {
    return `${this.baseUrl}/${z}/${x}/${y}.png`;
  }

  private cacheKey(z: number, x: number, y: number): string {
    return `${z}/${x}/${y}`;
  }

  private touch(key: string, tile: TerrainTile): void {
    this.cache.delete(key);
    this.cache.set(key, tile);
    while (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  async getTile(z: number, x: number, y: number): Promise<TerrainTile> {
    const key = this.cacheKey(z, x, y);
    const cached = this.cache.get(key);
    if (cached) {
      this.touch(key, cached);
      return { ...cached, fromCache: true };
    }
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const res = await fetchWithTimeout(this.tileUrl(z, x, y), this.timeoutMs);
        const bytes = await res.arrayBuffer();
        const img = await this.loadRgba(bytes);
        if (img.w !== TILE_PX || img.h !== TILE_PX) {
          throw new Error(`[live-data] unexpected tile size ${img.w}x${img.h}`);
        }
        const elevFt = decodeTerrariumRgba(img.rgba, TILE_PX * TILE_PX);
        for (let i = 0; i < elevFt.length; i += 1) {
          if (!Number.isFinite(elevFt[i])) throw new Error('[live-data] non-finite tile elevation');
        }
        const tile: TerrainTile = { z, x, y, elevFt, fromCache: false };
        this.touch(key, tile);
        this.lastOkAt = Date.now();
        this.lastOkSeq = ++this.eventSeq;
        return tile;
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) await sleep(250 * 2 ** attempt);
      }
    }
    this.lastFailAt = Date.now();
    this.lastFailSeq = ++this.eventSeq;
    this.lastFailDetail = lastError instanceof Error ? lastError.message : String(lastError);
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /** Lightweight health probe: one small tile fetch. Never throws. */
  async probe(z: number, x: number, y: number): Promise<boolean> {
    try {
      await this.getTile(z, x, y);
      return true;
    } catch {
      return false;
    }
  }

  endpointSnapshot(nowMs: number = Date.now()): SourceSnapshot {
    const ageSec = this.lastOkAt == null ? null : Math.max(0, (nowMs - this.lastOkAt) / 1000);
    if (this.lastOkAt == null) {
      return {
        status: 'SOURCE_UNAVAILABLE',
        asOfIso: null,
        ageSec: null,
        detail: `terrain endpoint unreachable${this.lastFailDetail ? ` (${this.lastFailDetail})` : ''}`,
      };
    }
    const degraded = this.lastFailSeq > this.lastOkSeq;
    return {
      status: degraded ? 'STALE' : 'LIVE',
      asOfIso: new Date(this.lastOkAt).toISOString(),
      ageSec,
      detail: degraded
        ? 'terrain endpoint down — serving cached tiles'
        : 'terrain endpoint reachable',
    };
  }
}

/**
 * Resample a set of decoded tiles onto a domain grid (nx × ny cells at dxFt,
 * centred on the anchor lat/lon). Pure and deterministic.
 */
export function mosaicToGrid(
  tiles: TerrainTile[],
  z: number,
  nx: number,
  ny: number,
  dxFt: number,
  anchorLat: number,
  anchorLon: number,
): number[][] {
  if (tiles.length === 0) throw new Error('[live-data] no tiles to mosaic');
  const byKey = new Map<string, TerrainTile>();
  for (const t of tiles) byKey.set(`${t.x},${t.y}`, t);
  const xs = tiles.map((t) => t.x);
  const ys = tiles.map((t) => t.y);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);

  const sampleLonLat = (lon: number, lat: number): number => {
    const fx = lonToTileX(lon, z);
    const fy = latToTileY(lat, z);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const tile = byKey.get(`${tx},${ty}`);
    if (!tile) throw new Error(`[live-data] tile ${z}/${tx}/${ty} missing from mosaic`);
    const px = Math.min(TILE_PX - 1.001, Math.max(0, (fx - tx) * TILE_PX));
    const py = Math.min(TILE_PX - 1.001, Math.max(0, (fy - ty) * TILE_PX));
    const x00 = Math.floor(px);
    const y00 = Math.floor(py);
    const fxr = px - x00;
    const fyr = py - y00;
    const e = tile.elevFt;
    const a = e[y00 * TILE_PX + x00];
    const b = e[y00 * TILE_PX + x00 + 1];
    const c = e[(y00 + 1) * TILE_PX + x00];
    const d = e[(y00 + 1) * TILE_PX + x00 + 1];
    return a + (b - a) * fxr + (c - a) * fyr + (a - b - c + d) * fxr * fyr;
  };

  void x0;
  void y0;
  const cosLat = Math.cos((anchorLat * Math.PI) / 180);
  const ftPerDegLat = 364000;
  const ftPerDegLon = 364000 * cosLat;
  const halfX = (nx * dxFt) / 2;
  const halfY = (ny * dxFt) / 2;
  const out: number[][] = [];
  for (let r = 0; r < ny; r += 1) {
    const row: number[] = [];
    const northFt = halfY - (r + 0.5) * dxFt;
    const lat = anchorLat + northFt / ftPerDegLat;
    for (let c = 0; c < nx; c += 1) {
      const eastFt = -halfX + (c + 0.5) * dxFt;
      const lon = anchorLon + eastFt / ftPerDegLon;
      row.push(sampleLonLat(lon, lat));
    }
    out.push(row);
  }
  return out;
}

export interface LiveTerrainFetchArgs {
  client: TerrainTileClient;
  anchorLat: number;
  anchorLon: number;
  /** Half-extent of the fetch window, degrees. Must cover the domain. */
  halfExtentDeg: number;
  zoom?: number;
  nx: number;
  ny: number;
  dxFt: number;
}

/**
 * Fetch live terrain for a domain. Throws on any failure — the caller
 * (`resolveTerrainWithFallback`) converts the throw into a labeled fallback.
 */
export async function fetchLiveTerrainGrid(args: LiveTerrainFetchArgs): Promise<number[][]> {
  const z = args.zoom ?? 13;
  const x0 = Math.floor(lonToTileX(args.anchorLon - args.halfExtentDeg, z));
  const x1 = Math.floor(lonToTileX(args.anchorLon + args.halfExtentDeg, z));
  const y0 = Math.floor(latToTileY(args.anchorLat + args.halfExtentDeg, z));
  const y1 = Math.floor(latToTileY(args.anchorLat - args.halfExtentDeg, z));
  const needed: Array<[number, number]> = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) needed.push([x, y]);
  }
  if (needed.length > 36) {
    throw new Error(`[live-data] refusing to fetch ${needed.length} tiles (window too large)`);
  }
  const tiles = await Promise.all(needed.map(([x, y]) => args.client.getTile(z, x, y)));
  const grid = mosaicToGrid(tiles, z, args.nx, args.ny, args.dxFt, args.anchorLat, args.anchorLon);
  // Sanity gate: the valley envelope. A corrupt decode must not reach the mesh.
  let min = Infinity;
  let max = -Infinity;
  for (const row of grid) {
    for (const v of row) {
      if (!Number.isFinite(v)) throw new Error('[live-data] non-finite live elevation');
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (min < 200 || max > 1200 || max - min > 900) {
    throw new Error(`[live-data] live elevation outside valley envelope (${min.toFixed(0)}..${max.toFixed(0)} ft)`);
  }
  return grid;
}

// --- unified fallback ---------------------------------------------------------

export type TerrainTier = 'live' | 'bundled-surveyed' | 'procedural';

export interface ResolvedLiveTerrain {
  grid: number[][];
  tier: TerrainTier;
  status: LiveStatus;
  /** Human label for legends/status badges — always names the actual source. */
  provenance: string;
  asOfIso: string | null;
  surveyed: ResolvedTerrainSource | null;
}

/**
 * The reliability contract in one call: try live tiles, then the bundled
 * 3DEP-derived grid, then the procedural approximation. Never throws for
 * source problems — the returned `tier`/`status` always say what happened.
 */
export async function resolveTerrainWithFallback(args: {
  client: TerrainTileClient;
  anchorLat: number;
  anchorLon: number;
  halfExtentDeg?: number;
  zoom?: number;
  nx: number;
  ny: number;
  dxFt: number;
  seed: number;
  baseElevFt: number;
  valleyReliefFt: number;
  noiseAmplitudeFt: number;
  terrainSource?: 'auto' | 'surveyed' | 'procedural';
}): Promise<ResolvedLiveTerrain> {
  const nowIso = new Date().toISOString();
  if ((args.terrainSource ?? 'auto') !== 'procedural') {
    try {
      const grid = await fetchLiveTerrainGrid({
        client: args.client,
        anchorLat: args.anchorLat,
        anchorLon: args.anchorLon,
        halfExtentDeg: args.halfExtentDeg ?? 0.03,
        zoom: args.zoom,
        nx: args.nx,
        ny: args.ny,
        dxFt: args.dxFt,
      });
      return {
        grid,
        tier: 'live',
        status: 'LIVE',
        provenance: `live Terrarium tiles (3DEP-derived), fetched ${nowIso} — screening-level`,
        asOfIso: nowIso,
        surveyed: null,
      };
    } catch {
      // Fall through to the bundled grid, then procedural.
    }
  }
  const surveyed = resolveElevationGrid({
    nx: args.nx,
    ny: args.ny,
    dxFt: args.dxFt,
    seed: args.seed,
    baseElevFt: args.baseElevFt,
    valleyReliefFt: args.valleyReliefFt,
    noiseAmplitudeFt: args.noiseAmplitudeFt,
    terrainSource: args.terrainSource ?? 'auto',
  });
  if (surveyed.source === 'surveyed') {
    return {
      grid: surveyed.grid,
      tier: 'bundled-surveyed',
      status: 'STALE',
      provenance: `bundled ${surveyed.provenance} (live endpoint unreachable)`,
      asOfIso: null,
      surveyed,
    };
  }
  return {
    grid: surveyed.grid,
    tier: 'procedural',
    status: 'CANDIDATE_NOT_LIVE',
    provenance: surveyed.provenance,
    asOfIso: null,
    surveyed,
  };
}

// --- manager ------------------------------------------------------------------

function gaugeStatusToLive(s: RiverGaugeObservation['status']): LiveStatus {
  switch (s) {
    case 'current':
      return 'LIVE';
    case 'stale':
      return 'STALE';
    case 'unavailable':
      return 'SOURCE_UNAVAILABLE';
    case 'candidate':
      return 'CANDIDATE_NOT_LIVE';
  }
}

export interface LiveDataManagerOptions {
  terrainBaseUrl?: string;
  /** One tile used for the periodic endpoint health probe. */
  probeTile?: { z: number; x: number; y: number };
  /** How often to probe the terrain endpoint. Default 5 minutes. */
  healthIntervalMs?: number;
  /** How often to re-emit snapshots even without new data. Default 30 s. */
  heartbeatMs?: number;
  tileClientOptions?: TerrainTileClientOptions;
}

/**
 * Owns the polling lifecycle: gauge interval (via the shared river-gauges
 * poller) + terrain endpoint health probes. Consumers subscribe to snapshots;
 * the terrain *grid* itself is fetched on demand via `resolveTerrainWithFallback`
 * so a slow tile service can never block the first render.
 */
export class LiveDataManager {
  readonly terrainClient: TerrainTileClient;
  private readonly probeTile: { z: number; x: number; y: number };
  private readonly healthIntervalMs: number;
  private readonly heartbeatMs: number;
  private readonly subscribers = new Set<(s: LiveDataSnapshot) => void>();
  private gaugeRows: RiverGaugeObservation[] = [];
  private stopGaugePoll: (() => void) | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(opts: LiveDataManagerOptions = {}) {
    this.terrainClient = new TerrainTileClient(opts.terrainBaseUrl, opts.tileClientOptions);
    // Default probe tile covers the Posey County anchor at z13.
    this.probeTile = opts.probeTile ?? { z: 13, x: 2093, y: 3164 };
    this.healthIntervalMs = opts.healthIntervalMs ?? 5 * 60 * 1000;
    this.heartbeatMs = opts.heartbeatMs ?? 30 * 1000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stopGaugePoll = startGaugePoll((rows) => {
      this.gaugeRows = rows;
      this.emit();
    }, 60_000);
    const probe = () => {
      void this.terrainClient.probe(this.probeTile.z, this.probeTile.x, this.probeTile.y).then(() => this.emit());
    };
    void probe();
    this.healthTimer = setInterval(probe, this.healthIntervalMs);
    this.heartbeatTimer = setInterval(() => this.emit(), this.heartbeatMs);
  }

  stop(): void {
    this.running = false;
    this.stopGaugePoll?.();
    this.stopGaugePoll = null;
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.healthTimer = null;
    this.heartbeatTimer = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  subscribe(cb: (s: LiveDataSnapshot) => void): () => void {
    this.subscribers.add(cb);
    cb(this.snapshot());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  snapshot(nowMs: number = Date.now()): LiveDataSnapshot {
    const gauges: LiveDataSnapshot['gauges'] = {};
    for (const row of this.gaugeRows) {
      const observedMs = row.observedAt ? Date.parse(row.observedAt) : NaN;
      gauges[row.gaugeId] = {
        status: gaugeStatusToLive(row.status),
        asOfIso: row.observedAt,
        ageSec: Number.isFinite(observedMs) ? Math.max(0, (nowMs - observedMs) / 1000) : null,
        detail: `${row.name} — ${row.status}${row.provisional ? ' (provisional)' : ''}`,
        value: row.value,
        unit: row.unit,
      };
    }
    return {
      terrainEndpoint: this.terrainClient.endpointSnapshot(nowMs),
      gauges,
      updatedIso: new Date(nowMs).toISOString(),
    };
  }

  private emit(): void {
    if (!this.running) return;
    const snap = this.snapshot();
    for (const cb of this.subscribers) {
      try {
        cb(snap);
      } catch {
        // A subscriber must never break the polling loop.
      }
    }
  }
}
