/**
 * Non-destructive SDF terrain deltas for cut-and-fill.
 * Baseline DEM/Transvoxel mesh is NEVER mutated.
 */

export type PointTubeState =
  | 'OBSERVED' | 'DERIVED' | 'INTERPOLATED' | 'FORECAST' | 'SIMULATED' | 'EVENT';

export interface SdfDeltaLayer {
  id: string;
  label: string;
  sdf: Float32Array;
  origin: [number, number, number];
  spacing: [number, number, number];
  dims: [number, number, number];
  state: PointTubeState;
  netVolumeM3?: number;
  slopeMaxRatio?: number;
  createdAtIso: string;
  sha256?: string;
}

export interface CutFillResult {
  cutM3: number;
  fillM3: number;
  netM3: number;
  steepCells: number;
  layer: SdfDeltaLayer;
}

const EPS = 1e-6;

export function computeCutFill(layer: SdfDeltaLayer): CutFillResult {
  const [nx, ny, nz] = layer.dims;
  const [dx, dy, dz] = layer.spacing;
  const cellVol = Math.abs(dx * dy * dz);
  let cut = 0;
  let fill = 0;
  let steep = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = i + nx * (j + ny * k);
        const v = layer.sdf[idx];
        if (v < -EPS) fill += cellVol;
        else if (v > EPS) cut += cellVol;
        if (i + 1 < nx && j + 1 < ny) {
          const vx = layer.sdf[idx + 1] - v;
          const vy = layer.sdf[idx + nx] - v;
          const slope = Math.sqrt(vx * vx + vy * vy) / Math.max(Math.abs(dx), Math.abs(dy), EPS);
          if (slope > 1 / 3 + EPS) steep += 1;
        }
      }
    }
  }
  const net = fill - cut;
  layer.netVolumeM3 = net;
  return { cutM3: cut, fillM3: fill, netM3: net, steepCells: steep, layer };
}

export function requiresErosionControl(result: CutFillResult): boolean {
  return result.steepCells > 0 || result.cutM3 > 50;
}
