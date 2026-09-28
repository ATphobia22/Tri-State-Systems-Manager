/**
 * world/terrain.ts — terrain mesh for the flood-sim open world.
 *
 * DATA-QUALITY CONTRACT (read before reusing):
 * This module resolves its elevation grid from one of two sources:
 *
 * 1. `source-derived` — the bundled source-derived screening grid
 *    (`world/data/source-derived-dem-posey.json`, fetched by
 *    `tools/terrain/fetch-terrarium-dem.py` from AWS elevation-tiles-prod
 *    Terrarium tiles; CONUS portion sourced from USGS 3DEP/NED per the
 *    Tilezen joerd attribution — a mosaic with mixed native vertical
 *    datums). ~15 m source posting resampled to a 62.5 ft canonical grid.
 *    It is a SCREENING-LEVEL derivative: better than the procedural
 *    approximation, but NOT survey-grade, NOT a substitute for licensed
 *    survey, and NOT valid for regulatory/design elevation decisions.
 *    Labeled `source-derived-screening`.
 * 2. `procedural` — the deterministic seeded value-noise approximation used
 *    before real elevation existed (and still the fallback when the
 *    source-derived bundle is missing or fails validation). Labeled
 *    `procedural-approximation — not surveyed terrain`.
 *
 * `resolveElevationGrid()` implements the fallback chain: source-derived
 * (validated) → procedural. It never throws on source problems; only on
 * invalid caller options. The mesh, the UI legend, and the docs must always
 * display the resolved `source`/`dataQuality` labels — never present
 * procedural output as source-derived, and never present the source-derived
 * screening grid as engineering-grade.
 *
 * The pure elevation-grid generator is separated from the three.js mesh
 * builder so it stays unit-testable without a GL context.
 */

import * as THREE from 'three';
import { mulberry32 } from '../prng';
import { computeHillshade } from './hillshade';
import tileFabric from '../../../../../artifacts/tsm-geospatial-tile-fabric-v1.json';
import sourceDerivedDemJson from './data/source-derived-dem-posey.json';

/** DEM service entries from the tile-fabric manifest that inform this terrain. */
export interface DemSourceRef {
  id: string;
  dataset: string;
  authority: string;
  sourceUrl: string;
  verticalDatum: string;
  status: string;
}

interface TileFabricAsset {
  id?: string;
  dataset?: string;
  authority?: string;
  sourceUrl?: string;
  verticalDatum?: string;
  status?: string;
  layerType?: string;
}

function readDemSources(): DemSourceRef[] {
  const assets = (tileFabric as { assets?: TileFabricAsset[] }).assets ?? [];
  return assets
    .filter((a) => a.layerType === 'terrain')
    .map((a) => ({
      id: a.id ?? 'unknown',
      dataset: a.dataset ?? 'unknown',
      authority: a.authority ?? 'unknown',
      sourceUrl: a.sourceUrl ?? '',
      verticalDatum: a.verticalDatum ?? 'unknown',
      status: a.status ?? 'unknown',
    }));
}

/** Authoritative DEM services referenced (metadata only — no tile bytes bundled). */
export const DEM_SOURCES: readonly DemSourceRef[] = readDemSources();

export interface TerrainGenOptions {
  nx: number;
  ny: number;
  dxFt: number;
  /** Deterministic seed for the refinement noise. */
  seed: number;
  /** Base elevation of the domain centre, ft (datum-consistent with engine). */
  baseElevFt: number;
  /** Valley relief: west (river) side is lower by this many ft. */
  valleyReliefFt: number;
  /** Peak-to-peak amplitude of the seeded refinement noise, ft. */
  noiseAmplitudeFt: number;
  /** Noise octaves (1–4). */
  octaves?: number;
}

/** Data-quality tag stamped on everything this module produces. */
export type TerrainDataQuality =
  | 'live-terrain-service'
  | 'source-derived-screening'
  | 'procedural-approximation';
/** Back-compat export: the pre-survey default. */
export const TERRAIN_DATA_QUALITY = 'procedural-approximation' as const;

/** Which elevation source to resolve. `auto` prefers source-derived, falls back silently. */
export type TerrainSourcePreference = 'auto' | 'source-derived' | 'procedural';

interface SourceDerivedBundle {
  id?: string;
  n?: number;
  cellFt?: number;
  halfExtentFt?: number;
  verticalDatum?: string;
  horizontalDatum?: string;
  source?: string;
  sha256?: string;
  statsFt?: { min?: number; max?: number; mean?: number };
  gridFt?: number[];
}

export interface SourceDerivedMeta {
  id: string;
  source: string;
  verticalDatum: string;
  horizontalDatum: string;
  cellFt: number;
  halfExtentFt: number;
  sha256: string;
  statsFt: { min: number; max: number; mean: number };
}

export interface ResolvedTerrainSource {
  /** Elevation grid, [row][col], ny × nx, ft, domain-local ENU centred on the anchor. */
  grid: number[][];
  source: 'source-derived' | 'procedural';
  dataQuality: TerrainDataQuality;
  /** Short human label for legends/status badges. */
  provenance: string;
  sourceDerivedMeta: SourceDerivedMeta | null;
}

function readSourceDerivedBundle(): SourceDerivedBundle | null {
  const b = sourceDerivedDemJson as SourceDerivedBundle;
  if (!b || !Array.isArray(b.gridFt) || typeof b.n !== 'number') return null;
  return b;
}

function validateSourceDerivedBundle(b: SourceDerivedBundle): SourceDerivedMeta | null {
  const n = b.n ?? 0;
  const grid = b.gridFt ?? [];
  if (!Number.isInteger(n) || n < 2 || grid.length !== n * n) return null;
  const cellFt = b.cellFt;
  const halfExtentFt = b.halfExtentFt;
  if (cellFt === undefined || halfExtentFt === undefined || !(cellFt > 0) || !(halfExtentFt > 0)) {
    return null;
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < grid.length; i += 1) {
    const v = grid[i];
    if (!Number.isFinite(v)) return null;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  // Sanity envelope for the Ohio–Wabash valley (ft): rejects corrupt decodes
  // without pretending to certify the values.
  if (min < 200 || max > 1200 || max - min > 900) return null;
  return {
    id: b.id ?? 'source-derived-dem-unknown',
    source: b.source ?? 'unknown',
    verticalDatum: b.verticalDatum ?? 'unknown',
    horizontalDatum: b.horizontalDatum ?? 'unknown',
    cellFt,
    halfExtentFt,
    sha256: b.sha256 ?? 'unknown',
    statsFt: { min, max, mean: sum / grid.length },
  };
}

/**
 * Bilinear-resample the canonical source-derived grid (row 0 = north edge,
 * ENU feet relative to the anchor) onto a target domain grid of nx × ny
 * cells at dxFt, centred on the same anchor. Deterministic.
 */
function resampleSurveyed(
  b: SourceDerivedBundle,
  meta: SourceDerivedMeta,
  nx: number,
  ny: number,
  dxFt: number,
): number[][] | null {
  const n = b.n as number;
  const grid = b.gridFt as number[];
  const halfTargetX = (nx * dxFt) / 2;
  const halfTargetY = (ny * dxFt) / 2;
  if (halfTargetX > meta.halfExtentFt || halfTargetY > meta.halfExtentFt) return null;
  const cell = meta.cellFt;
  const he = meta.halfExtentFt;

  const sampleAt = (eastFt: number, northFt: number): number => {
    // Canonical layout: col c centre at east = -he + (c+0.5)*cell;
    // row r centre at north = he - (r+0.5)*cell.
    const c = (eastFt + he) / cell - 0.5;
    const r = (he - northFt) / cell - 0.5;
    const cc = Math.min(n - 1.001, Math.max(0, c));
    const rr = Math.min(n - 1.001, Math.max(0, r));
    const c0 = Math.floor(cc);
    const r0 = Math.floor(rr);
    const fc = cc - c0;
    const fr = rr - r0;
    const a = grid[r0 * n + c0];
    const bb = grid[r0 * n + c0 + 1];
    const cc2 = grid[(r0 + 1) * n + c0];
    const d = grid[(r0 + 1) * n + c0 + 1];
    return a + (bb - a) * fc + (cc2 - a) * fr + (a - bb - cc2 + d) * fc * fr;
  };

  const out: number[][] = [];
  for (let r = 0; r < ny; r += 1) {
    const row: number[] = [];
    const northFt = halfTargetY - (r + 0.5) * dxFt; // row 0 = north edge
    for (let c = 0; c < nx; c += 1) {
      const eastFt = -halfTargetX + (c + 0.5) * dxFt;
      row.push(sampleAt(eastFt, northFt));
    }
    out.push(row);
  }
  return out;
}

/**
 * Deterministic value-noise elevation grid, [row][col], ny × nx.
 * Same options ⇒ bit-identical grid (mulberry32 integer arithmetic).
 */
export function generateElevationGrid(opts: TerrainGenOptions): number[][] {
  const { nx, ny, dxFt, seed, baseElevFt, valleyReliefFt, noiseAmplitudeFt } = opts;
  const octaves = Math.min(4, Math.max(1, opts.octaves ?? 3));
  if (!Number.isInteger(nx) || nx <= 0 || !Number.isInteger(ny) || ny <= 0) {
    throw new Error('[flood-sim-terrain] nx/ny must be positive integers');
  }

  const rng = mulberry32(seed >>> 0);
  // One random lattice per octave; lattice spacing halves each octave.
  const lattices: Float32Array[] = [];
  const latticeSizes: number[] = [];
  for (let o = 0; o < octaves; o += 1) {
    const size = 4 * 2 ** o + 1;
    latticeSizes.push(size);
    const lattice = new Float32Array(size * size);
    for (let i = 0; i < lattice.length; i += 1) {
      lattice[i] = rng.next() * 2 - 1;
    }
    lattices.push(lattice);
  }

  const smooth = (t: number): number => t * t * (3 - 2 * t);

  const noiseAt = (u: number, v: number): number => {
    // u, v in [0, 1] across the domain.
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      const size = latticeSizes[o];
      const lat = lattices[o];
      const x = u * (size - 1);
      const y = v * (size - 1);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = Math.min(size - 1, x0 + 1);
      const y1 = Math.min(size - 1, y0 + 1);
      const fx = smooth(x - x0);
      const fy = smooth(y - y0);
      const a = lat[y0 * size + x0];
      const b = lat[y0 * size + x1];
      const c = lat[y1 * size + x0];
      const d = lat[y1 * size + x1];
      const val = a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      sum += val * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };

  const grid: number[][] = [];
  for (let j = 0; j < ny; j += 1) {
    const row: number[] = [];
    for (let i = 0; i < nx; i += 1) {
      const u = nx === 1 ? 0 : i / (nx - 1);
      const v = ny === 1 ? 0 : j / (ny - 1);
      // Valley cross-slope: west edge (u=0, river side) lower than east.
      const valley = valleyReliefFt * (0.5 - u);
      // Gentle north-south tilt for visual interest.
      const tilt = 0.15 * valleyReliefFt * (v - 0.5);
      const noise = noiseAt(u, v) * noiseAmplitudeFt;
      // Keep the domain mean near baseElevFt regardless of dx.
      void dxFt;
      row.push(baseElevFt + valley + tilt + noise);
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Resolve the elevation grid for a scenario domain.
 *
 * Fallback chain (the reliability contract):
 *   1. `procedural` preference → seeded value-noise grid, always succeeds.
 *   2. `source-derived` preference → bundled source-derived grid resampled
 *      to the domain; throws a descriptive error when the bundle is
 *      missing/invalid (explicit choice ⇒ fail loudly, never silently
 *      downgrade).
 *   3. `auto` (default) → source-derived when it validates, else procedural
 *      with a console warning. Never throws on source problems.
 */
export function resolveElevationGrid(
  opts: TerrainGenOptions & { terrainSource?: TerrainSourcePreference },
): ResolvedTerrainSource {
  const preference = opts.terrainSource ?? 'auto';
  if (preference === 'procedural') {
    return {
      grid: generateElevationGrid(opts),
      source: 'procedural',
      dataQuality: 'procedural-approximation',
      provenance: 'procedural approximation — not surveyed terrain',
      sourceDerivedMeta: null,
    };
  }
  const bundle = readSourceDerivedBundle();
  const meta = bundle ? validateSourceDerivedBundle(bundle) : null;
  const resampled =
    bundle && meta ? resampleSurveyed(bundle, meta, opts.nx, opts.ny, opts.dxFt) : null;
  if (resampled && meta) {
    return {
      grid: resampled,
      source: 'source-derived',
      dataQuality: 'source-derived-screening',
      provenance:
        `3DEP-derived screening grid (${meta.id}; vertical datum ${meta.verticalDatum}) — ` +
        `not survey-grade`,
      sourceDerivedMeta: meta,
    };
  }
  if (preference === 'source-derived') {
    throw new Error(
      '[flood-sim-terrain] source-derived elevation requested but the bundled source-derived ' +
        'grid is missing, corrupt, or does not cover the requested domain',
    );
  }
  if (typeof console !== 'undefined') {
    console.warn(
      '[flood-sim-terrain] source-derived elevation unavailable — falling back to procedural approximation',
    );
  }
  return {
    grid: generateElevationGrid(opts),
    source: 'procedural',
    dataQuality: 'procedural-approximation',
    provenance: 'procedural approximation — not surveyed terrain (surveyed bundle unavailable)',
    sourceDerivedMeta: null,
  };
}

/** Hypsometric tint: lowland green → tan → upland brown-grey. */
function elevationColor(elevFt: number, minFt: number, maxFt: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (elevFt - minFt) / Math.max(1e-6, maxFt - minFt)));
  // Stops: deep lowland, grass, dry tan, upland.
  const stops: Array<[number, [number, number, number]]> = [
    [0.0, [0.16, 0.32, 0.18]],
    [0.45, [0.35, 0.48, 0.24]],
    [0.75, [0.55, 0.5, 0.36]],
    [1.0, [0.62, 0.58, 0.52]],
  ];
  for (let s = 1; s < stops.length; s += 1) {
    if (t <= stops[s][0]) {
      const [t0, c0] = stops[s - 1];
      const [t1, c1] = stops[s];
      const f = (t - t0) / Math.max(1e-9, t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1][1];
}

export interface BuiltTerrain {
  mesh: THREE.Mesh;
  elevationFt: number[][];
  dataQuality: TerrainDataQuality;
  /** Human label describing the resolved elevation source. */
  provenance: string;
  demSources: readonly DemSourceRef[];
  sourceDerivedMeta: SourceDerivedMeta | null;
  /** Bilinear height sampler in grid coordinates (fractional col/row ok). */
  heightAt(col: number, row: number): number;
  dispose(): void;
}

/**
 * Build the three.js terrain mesh. `segments` controls visual density
 * (quality tier); the underlying elevation grid keeps full nx × ny.
 *
 * Pass `elevationFt` to mesh an externally built grid (e.g. the engine's
 * grid from `scenarioToEngineConfig`, or a grid from `resolveElevationGrid`)
 * so visuals and physics agree exactly; pass `sourceInfo` alongside so the
 * mesh carries the right data-quality labels. Without `sourceInfo`, a
 * caller-supplied grid is labeled procedural-approximation (the historical
 * default — callers resolving source-derived grids must pass the labels through).
 *
 * Vertex colours combine the hypsometric tint with an analytic hillshade
 * (Horn's method) so relief reads even in flat floodplain country.
 */
export function buildTerrainMesh(
  opts: TerrainGenOptions & {
    segments?: number;
    elevationFt?: number[][];
    sourceInfo?: Pick<ResolvedTerrainSource, 'source' | 'dataQuality' | 'provenance' | 'sourceDerivedMeta'>;
    hillshade?: { azimuthDeg?: number; altitudeDeg?: number; zFactor?: number; floor?: number };
  },
): BuiltTerrain {
  const elevationFt = opts.elevationFt ?? generateElevationGrid(opts);
  const ny = elevationFt.length;
  const nx = elevationFt[0]?.length ?? 0;
  if (ny === 0 || nx === 0) throw new Error('[flood-sim-terrain] empty elevation grid');
  const segments = opts.segments ?? 128;
  const dxFt = opts.dxFt;
  const sourceInfo = opts.sourceInfo ?? {
    source: 'procedural' as const,
    dataQuality: 'procedural-approximation' as const,
    provenance: 'procedural approximation — not surveyed terrain',
    sourceDerivedMeta: null,
  };

  const widthFt = nx * dxFt;
  const depthFt = ny * dxFt;
  const geometry = new THREE.PlaneGeometry(widthFt, depthFt, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  let minFt = Infinity;
  let maxFt = -Infinity;
  for (const row of elevationFt) {
    for (const v of row) {
      if (v < minFt) minFt = v;
      if (v > maxFt) maxFt = v;
    }
  }

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const bilinear = (
    field: (r: number, c: number) => number,
    col: number,
    row: number,
  ): number => {
    const c = Math.min(nx - 1.001, Math.max(0, col));
    const r = Math.min(ny - 1.001, Math.max(0, row));
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const a = field(r0, c0);
    const b = field(r0, c0 + 1);
    const cc = field(r0 + 1, c0);
    const d = field(r0 + 1, c0 + 1);
    return a + (b - a) * fc + (cc - a) * fr + (a - b - cc + d) * fc * fr;
  };
  const heightAt = (col: number, row: number): number =>
    bilinear((r, c) => elevationFt[r][c], col, row);

  // Analytic hillshade on the grid, sampled per-vertex like height.
  const hs = opts.hillshade ?? {};
  const shadeGrid = computeHillshade(elevationFt, dxFt, {
    azimuthDeg: hs.azimuthDeg,
    altitudeDeg: hs.altitudeDeg,
    zFactor: hs.zFactor,
  });
  const shadeAt = (col: number, row: number): number =>
    bilinear((r, c) => shadeGrid[r * nx + c], col, row);
  const shadeFloor = hs.floor ?? 0.45;

  for (let vi = 0; vi < pos.count; vi += 1) {
    const x = pos.getX(vi); // -width/2 .. width/2 (east)
    const z = pos.getZ(vi); // -depth/2 .. depth/2 (south positive)
    const col = (x + widthFt / 2) / dxFt - 0.5;
    const row = (z + depthFt / 2) / dxFt - 0.5;
    const h = heightAt(col, row);
    pos.setY(vi, h);
    const [r, g, b] = elevationColor(h, minFt, maxFt);
    const m = shadeFloor + (1 - shadeFloor) * shadeAt(col, row);
    colors[vi * 3] = r * m;
    colors[vi * 3 + 1] = g * m;
    colors[vi * 3 + 2] = b * m;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name =
    sourceInfo.source === 'source-derived'
      ? 'flood-sim-terrain (3DEP-derived screening grid — not survey-grade)'
      : 'flood-sim-terrain (procedural approximation — not surveyed)';
  // Centre the domain on the origin; world frame is local ENU feet.
  mesh.position.set(0, 0, 0);

  return {
    mesh,
    elevationFt,
    dataQuality: sourceInfo.dataQuality,
    provenance: sourceInfo.provenance,
    demSources: DEM_SOURCES,
    sourceDerivedMeta: sourceInfo.sourceDerivedMeta,
    heightAt,
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
