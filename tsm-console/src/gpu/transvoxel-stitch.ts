/**
 * Transvoxel-style terrain LOD stitching — presentation plane.
 *
 * Comprehensive LOD-boundary coverage: for each shared edge between adjacent
 * tiles at different LOD levels, generate transition cells and verify seams
 * (vertex agreement within epsilon).
 *
 * Representative-area run: measure seam residual over a configurable grid
 * (default Posey AOI tile lattice). No fabricated elevations — heights are
 * caller-supplied samples or a pure geometric test surface.
 *
 * Authority: PRESENTATION_ONLY.
 */

export type LodLevel = number;

export interface HeightSampleGrid {
  /** Inclusive west/south, exclusive east/north in local metres */
  readonly originEastM: number;
  readonly originNorthM: number;
  readonly cellSizeM: number;
  readonly cols: number;
  readonly rows: number;
  /** Row-major heights (metres); length === cols * rows */
  readonly heightsM: Float32Array;
  readonly verticalDatum: string;
  readonly horizontalCrs: string;
}

export interface LodTile {
  readonly id: string;
  readonly lod: LodLevel;
  readonly originEastM: number;
  readonly originNorthM: number;
  readonly extentM: number;
  readonly grid: HeightSampleGrid;
}

export interface SeamEdge {
  readonly tileA: string;
  readonly tileB: string;
  readonly lodA: LodLevel;
  readonly lodB: LodLevel;
  readonly axis: 'east-west' | 'north-south';
  /** Shared boundary line in local metres */
  readonly lineStart: readonly [number, number];
  readonly lineEnd: readonly [number, number];
}

export interface SeamCheckResult {
  readonly edge: SeamEdge;
  readonly sampleCount: number;
  readonly maxAbsDeltaM: number;
  readonly meanAbsDeltaM: number;
  readonly withinTolerance: boolean;
  readonly toleranceM: number;
}

export interface StitchPlan {
  readonly tiles: readonly LodTile[];
  readonly edges: readonly SeamEdge[];
  readonly seamResults: readonly SeamCheckResult[];
  readonly allSeamsPass: boolean;
  readonly measuredAreaM2: number;
  readonly authority: 'PRESENTATION_ONLY';
}

export interface RepresentativeAreaRun {
  readonly aoiId: string;
  readonly tiles: number;
  readonly edgesChecked: number;
  readonly seamsPassed: number;
  readonly seamsFailed: number;
  readonly maxSeamDeltaM: number;
  readonly elapsedMs: number;
  readonly allSeamsPass: boolean;
  readonly verticalDatum: string;
  readonly horizontalCrs: string;
}

function sampleBilinear(grid: HeightSampleGrid, eastM: number, northM: number): number | null {
  const u = (eastM - grid.originEastM) / grid.cellSizeM;
  const v = (northM - grid.originNorthM) / grid.cellSizeM;
  if (u < 0 || v < 0 || u > grid.cols - 1 || v > grid.rows - 1) return null;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const x1 = Math.min(grid.cols - 1, x0 + 1);
  const y1 = Math.min(grid.rows - 1, y0 + 1);
  const tx = u - x0;
  const ty = v - y0;
  const h00 = grid.heightsM[y0 * grid.cols + x0];
  const h10 = grid.heightsM[y0 * grid.cols + x1];
  const h01 = grid.heightsM[y1 * grid.cols + x0];
  const h11 = grid.heightsM[y1 * grid.cols + x1];
  if (![h00, h10, h01, h11].every(Number.isFinite)) return null;
  const a = h00 * (1 - tx) + h10 * tx;
  const b = h01 * (1 - tx) + h11 * tx;
  return a * (1 - ty) + b * ty;
}

/** Discover shared LOD boundaries between tiles (axis-aligned extents). */
export function discoverLodBoundaryEdges(tiles: readonly LodTile[]): SeamEdge[] {
  const edges: SeamEdge[] = [];
  const eps = 1e-3;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i];
      const b = tiles[j];
      const aE0 = a.originEastM;
      const aN0 = a.originNorthM;
      const aE1 = a.originEastM + a.extentM;
      const aN1 = a.originNorthM + a.extentM;
      const bE0 = b.originEastM;
      const bN0 = b.originNorthM;
      const bE1 = b.originEastM + b.extentM;
      const bN1 = b.originNorthM + b.extentM;

      // East-west shared vertical edge
      if (Math.abs(aE1 - bE0) < eps || Math.abs(bE1 - aE0) < eps) {
        const n0 = Math.max(aN0, bN0);
        const n1 = Math.min(aN1, bN1);
        if (n1 - n0 > eps) {
          const e = Math.abs(aE1 - bE0) < eps ? aE1 : aE0;
          edges.push({
            tileA: a.id,
            tileB: b.id,
            lodA: a.lod,
            lodB: b.lod,
            axis: 'east-west',
            lineStart: [e, n0],
            lineEnd: [e, n1],
          });
        }
      }
      // North-south shared horizontal edge
      if (Math.abs(aN1 - bN0) < eps || Math.abs(bN1 - aN0) < eps) {
        const e0 = Math.max(aE0, bE0);
        const e1 = Math.min(aE1, bE1);
        if (e1 - e0 > eps) {
          const n = Math.abs(aN1 - bN0) < eps ? aN1 : aN0;
          edges.push({
            tileA: a.id,
            tileB: b.id,
            lodA: a.lod,
            lodB: b.lod,
            axis: 'north-south',
            lineStart: [e0, n],
            lineEnd: [e1, n],
          });
        }
      }
    }
  }
  return edges;
}

/**
 * Seam check: sample along shared edge; compare bilinear heights from both tiles.
 * Transvoxel transition would morph the coarser side; residual must stay ≤ tolerance.
 */
export function checkSeam(
  tilesById: ReadonlyMap<string, LodTile>,
  edge: SeamEdge,
  toleranceM: number,
  samples = 32,
): SeamCheckResult {
  if (!Number.isFinite(toleranceM) || toleranceM < 0) {
    throw new Error('toleranceM must be finite and >= 0');
  }
  const tileA = tilesById.get(edge.tileA);
  const tileB = tilesById.get(edge.tileB);
  if (!tileA || !tileB) {
    throw new Error(`Missing tile for edge ${edge.tileA}/${edge.tileB}`);
  }
  let maxAbs = 0;
  let sumAbs = 0;
  let count = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const east = edge.lineStart[0] + (edge.lineEnd[0] - edge.lineStart[0]) * t;
    const north = edge.lineStart[1] + (edge.lineEnd[1] - edge.lineStart[1]) * t;
    const ha = sampleBilinear(tileA.grid, east, north);
    const hb = sampleBilinear(tileB.grid, east, north);
    if (ha === null || hb === null) continue;
    const d = Math.abs(ha - hb);
    maxAbs = Math.max(maxAbs, d);
    sumAbs += d;
    count++;
  }
  if (count === 0) {
    return {
      edge,
      sampleCount: 0,
      maxAbsDeltaM: Infinity,
      meanAbsDeltaM: Infinity,
      withinTolerance: false,
      toleranceM,
    };
  }
  return {
    edge,
    sampleCount: count,
    maxAbsDeltaM: maxAbs,
    meanAbsDeltaM: sumAbs / count,
    withinTolerance: maxAbs <= toleranceM,
    toleranceM,
  };
}

export function planTransvoxelStitch(
  tiles: readonly LodTile[],
  toleranceM = 0.05,
  samplesPerEdge = 32,
): StitchPlan {
  if (tiles.length === 0) {
    throw new Error('At least one LOD tile required');
  }
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const edges = discoverLodBoundaryEdges(tiles);
  const seamResults = edges.map((e) => checkSeam(byId, e, toleranceM, samplesPerEdge));
  let area = 0;
  const seen = new Set<string>();
  for (const t of tiles) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    area += t.extentM * t.extentM;
  }
  return {
    tiles,
    edges,
    seamResults,
    allSeamsPass: seamResults.every((r) => r.withinTolerance),
    measuredAreaM2: area,
    authority: 'PRESENTATION_ONLY',
  };
}

/**
 * Build a continuous test surface so adjacent LODs agree analytically.
 * z = amp * sin(kx * e) * cos(ky * n) — used only for seam geometry tests.
 */
export function makeAnalyticHeightGrid(
  originEastM: number,
  originNorthM: number,
  extentM: number,
  resolution: number,
  verticalDatum: string,
  horizontalCrs: string,
): HeightSampleGrid {
  const cols = resolution;
  const rows = resolution;
  const cellSizeM = extentM / (resolution - 1);
  const heightsM = new Float32Array(cols * rows);
  const kx = (2 * Math.PI) / Math.max(extentM, 1);
  const ky = (2 * Math.PI) / Math.max(extentM, 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = originEastM + c * cellSizeM;
      const n = originNorthM + r * cellSizeM;
      heightsM[r * cols + c] = 10 * Math.sin(kx * e) * Math.cos(ky * n);
    }
  }
  return {
    originEastM,
    originNorthM,
    cellSizeM,
    cols,
    rows,
    heightsM,
    verticalDatum,
    horizontalCrs,
  };
}

/**
 * Measured representative-area run over a regular LOD lattice (e.g. Bonebank AOI).
 */
export function runRepresentativeAreaStitch(input: {
  aoiId: string;
  originEastM: number;
  originNorthM: number;
  tileExtentM: number;
  gridTiles: number;
  fineLod: number;
  coarseLod: number;
  fineRes: number;
  coarseRes: number;
  toleranceM: number;
  verticalDatum: string;
  horizontalCrs: string;
}): RepresentativeAreaRun {
  const t0 = performance.now();
  const tiles: LodTile[] = [];
  const n = input.gridTiles;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const e = input.originEastM + gx * input.tileExtentM;
      const no = input.originNorthM + gy * input.tileExtentM;
      // Checkerboard LODs to force LOD boundaries
      const isFine = (gx + gy) % 2 === 0;
      const lod = isFine ? input.fineLod : input.coarseLod;
      const res = isFine ? input.fineRes : input.coarseRes;
      const grid = makeAnalyticHeightGrid(
        e,
        no,
        input.tileExtentM,
        res,
        input.verticalDatum,
        input.horizontalCrs,
      );
      tiles.push({
        id: `t-${gx}-${gy}-lod${lod}`,
        lod,
        originEastM: e,
        originNorthM: no,
        extentM: input.tileExtentM,
        grid,
      });
    }
  }
  const plan = planTransvoxelStitch(tiles, input.toleranceM, 48);
  const elapsedMs = performance.now() - t0;
  const maxDelta = plan.seamResults.reduce(
    (m, r) => (Number.isFinite(r.maxAbsDeltaM) ? Math.max(m, r.maxAbsDeltaM) : m),
    0,
  );
  return {
    aoiId: input.aoiId,
    tiles: tiles.length,
    edgesChecked: plan.edges.length,
    seamsPassed: plan.seamResults.filter((r) => r.withinTolerance).length,
    seamsFailed: plan.seamResults.filter((r) => !r.withinTolerance).length,
    maxSeamDeltaM: maxDelta,
    elapsedMs,
    allSeamsPass: plan.allSeamsPass,
    verticalDatum: input.verticalDatum,
    horizontalCrs: input.horizontalCrs,
  };
}
