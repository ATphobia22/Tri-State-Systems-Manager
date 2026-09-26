/**
 * world/terrain.ts — procedural terrain mesh for the flood-sim open world.
 *
 * HONESTY CONTRACT (read before reusing):
 * The tile-fabric manifest (`artifacts/tsm-geospatial-tile-fabric-v1.json`)
 * describes authoritative DEM *services* (USGS 3DEP, Indiana 2016–2020) but
 * bundles NO local tile bytes, so this module cannot render surveyed terrain.
 * Instead it builds a deterministic procedural approximation:
 *   - base surface anchored near the repo's owner-supplied site constants
 *     (BFE 375.0 ft NAVD88 context; anchor 13101 Bonebank Rd),
 *   - a gentle valley cross-slope toward the river side,
 *   - seeded value-noise refinement (mulberry32) for visual richness.
 * The mesh, the UI legend, and the docs all label this
 * "procedural approximation — not surveyed terrain". Never present it as
 * surveyed, authoritative, or engineering-grade elevation.
 *
 * The pure elevation-grid generator is separated from the three.js mesh
 * builder so it stays unit-testable without a GL context.
 */

import * as THREE from 'three';
import { mulberry32 } from '../prng';
import tileFabric from '../../../../../artifacts/tsm-geospatial-tile-fabric-v1.json';

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
export const TERRAIN_DATA_QUALITY = 'procedural-approximation' as const;

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
  dataQuality: typeof TERRAIN_DATA_QUALITY;
  demSources: readonly DemSourceRef[];
  /** Bilinear height sampler in grid coordinates (fractional col/row ok). */
  heightAt(col: number, row: number): number;
  dispose(): void;
}

/**
 * Build the three.js terrain mesh. `segments` controls visual density
 * (quality tier); the underlying elevation grid keeps full nx × ny.
 *
 * Pass `elevationFt` to mesh an externally built grid (e.g. the engine's
 * grid from `scenarioToEngineConfig`) so visuals and physics agree exactly;
 * otherwise the grid is generated from the remaining options.
 */
export function buildTerrainMesh(
  opts: TerrainGenOptions & { segments?: number; elevationFt?: number[][] },
): BuiltTerrain {
  const elevationFt = opts.elevationFt ?? generateElevationGrid(opts);
  const ny = elevationFt.length;
  const nx = elevationFt[0]?.length ?? 0;
  if (ny === 0 || nx === 0) throw new Error('[flood-sim-terrain] empty elevation grid');
  const segments = opts.segments ?? 128;
  const dxFt = opts.dxFt;

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
  const heightAt = (col: number, row: number): number => {
    const c = Math.min(nx - 1.001, Math.max(0, col));
    const r = Math.min(ny - 1.001, Math.max(0, row));
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const a = elevationFt[r0][c0];
    const b = elevationFt[r0][c0 + 1];
    const cc = elevationFt[r0 + 1][c0];
    const d = elevationFt[r0 + 1][c0 + 1];
    return a + (b - a) * fc + (cc - a) * fr + (a - b - cc + d) * fc * fr;
  };

  for (let vi = 0; vi < pos.count; vi += 1) {
    const x = pos.getX(vi); // -width/2 .. width/2 (east)
    const z = pos.getZ(vi); // -depth/2 .. depth/2 (south positive)
    const col = (x + widthFt / 2) / dxFt - 0.5;
    const row = (z + depthFt / 2) / dxFt - 0.5;
    const h = heightAt(col, row);
    pos.setY(vi, h);
    const [r, g, b] = elevationColor(h, minFt, maxFt);
    colors[vi * 3] = r;
    colors[vi * 3 + 1] = g;
    colors[vi * 3 + 2] = b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'flood-sim-terrain (procedural approximation — not surveyed)';
  // Centre the domain on the origin; world frame is local ENU feet.
  mesh.position.set(0, 0, 0);

  return {
    mesh,
    elevationFt,
    dataQuality: TERRAIN_DATA_QUALITY,
    demSources: DEM_SOURCES,
    heightAt,
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
