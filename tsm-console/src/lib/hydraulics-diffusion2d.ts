/**
 * 2D diffusion-wave (zero-inertia) overland-flow inundation model.
 *
 * WHAT THIS IS
 * ------------
 * An explicit finite-difference raster model of floodplain inundation based on the
 * diffusion-wave approximation of overland flow. Each grid cell stores a water depth;
 * inter-cell discharge per unit width is computed from the local water-surface slope
 * using Manning's friction relation, and depths are updated from the resulting flux
 * divergence plus rainfall. Domain edges are closed (no-flux) boundaries.
 *
 * WHY DIFFUSION-WAVE (physical basis)
 * -----------------------------------
 * The diffusion-wave form drops the local-acceleration and convective-acceleration
 * (inertia) terms from the momentum balance, leaving a balance between the
 * water-surface slope and Manning friction. This is justified for gradually-varied
 * floodplain flow — slow, subcritical spreading over gentle terrain, which is the
 * dominant regime in riverine floodplain inundation mapping. It is the pragmatic,
 * operational-standard approach for inundation extent/depth mapping: tractable,
 * and stable under an explicit diffusive time-step limit.
 *
 * THIS IS NOT a full inertia-inclusive momentum model. Do not use it, describe it,
 * or present its outputs as one.
 *
 * STABILITY REQUIREMENT (explicit diffusive CFL)
 * ----------------------------------------------
 * Writing the update as diffusion of the water surface with diffusivity
 *     D = h_flow^(5/3) / (n * sqrt(|S|))        [ft^2/s]
 * (h_flow = effective flow depth at a cell face, n = Manning's n,
 *  S = water-surface slope across the face), the explicit scheme is stable iff
 *     dt <= dx^2 / (4 * D_max)
 * evaluated over all cell faces. runDiffusionWave computes D_max from the initial
 * state (with faces of zero slope contributing no constraint, since zero slope
 * means zero flux and an unconditionally stable update) and THROWS — fail-closed —
 * if the requested dt violates the criterion. Depths are clamped >= 0 every step.
 *
 * LIMITATIONS
 * -----------
 * - Not valid for rapidly-varied flow: dam-break shock fronts, hydraulic jumps,
 *   or any supercritical (Froude > 1) regime, where neglected inertia dominates.
 * - Not valid for pressurized flow (culverts surcharging, storm sewers).
 * - No infiltration, evaporation, or drainage losses: rainfall is fully retained
 *   (impermeable plane). Volumes are therefore conservative upper bounds.
 * - Accuracy is first-order in space/time and degrades on steep terrain or with
 *   coarse grids; treat outputs as modeled estimates, labeled as such.
 */

import { makeProvenance, type Provenance } from './provenance-labels';

export interface DiffusionWaveInput {
  nx: number;
  ny: number;
  dxFt: number;
  /** Ground elevation in ft NAVD88 (or consistent datum), indexed [row][col], ny rows x nx cols. */
  elevationFt: number[][];
  manningN: number;
  /** Initial water depth per cell in ft; defaults to dry. Negative values are clamped to 0. */
  initialDepthFt?: number[][];
  /** Uniform rainfall rate in inches/hour (impermeable plane — fully retained). */
  rainfallInPerHr?: number;
}

export interface DiffusionWaveOutput {
  depthFt: number[][];
  maxDepthFt: number;
  floodedCellCount: number;
  totalVolumeFt3: number;
  provenance: Provenance;
}

const MODEL_VERSION = 'diffusion-wave-2d-v1';
const SLOPE_FLOOR = 1e-12; // |S| below this is treated as zero flux (unconditionally stable)
const FLOODED_EPS_FT = 0;

function fail(message: string): never {
  throw new Error(`[diffusion-wave-2d] ${message}`);
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function assertGrid(name: string, grid: number[][], nx: number, ny: number): void {
  if (!Array.isArray(grid) || grid.length !== ny) {
    fail(`${name} must have exactly ny=${ny} rows (got ${Array.isArray(grid) ? grid.length : 'non-array'}).`);
  }
  for (let j = 0; j < ny; j++) {
    const row = grid[j];
    if (!Array.isArray(row) || row.length !== nx) {
      fail(`${name} row ${j} must have exactly nx=${nx} columns.`);
    }
    for (let i = 0; i < nx; i++) {
      const v = row[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        fail(`${name}[${j}][${i}] must be a finite number.`);
      }
    }
  }
}

function validateInput(input: DiffusionWaveInput, durationHrs: number, dtSec: number): void {
  if (!isPositiveInteger(input.nx)) fail(`nx must be a positive integer (got ${input.nx}).`);
  if (!isPositiveInteger(input.ny)) fail(`ny must be a positive integer (got ${input.ny}).`);
  if (typeof input.dxFt !== 'number' || !Number.isFinite(input.dxFt) || input.dxFt <= 0) {
    fail(`dxFt must be a finite number > 0 (got ${input.dxFt}).`);
  }
  if (typeof input.manningN !== 'number' || !Number.isFinite(input.manningN) || input.manningN <= 0) {
    fail(`manningN must be a finite number > 0 (got ${input.manningN}).`);
  }
  assertGrid('elevationFt', input.elevationFt, input.nx, input.ny);
  if (input.initialDepthFt !== undefined) {
    assertGrid('initialDepthFt', input.initialDepthFt, input.nx, input.ny);
  }
  if (input.rainfallInPerHr !== undefined) {
    const r = input.rainfallInPerHr;
    if (typeof r !== 'number' || !Number.isFinite(r) || r < 0) {
      fail(`rainfallInPerHr must be a finite number >= 0 (got ${r}).`);
    }
  }
  if (typeof durationHrs !== 'number' || !Number.isFinite(durationHrs) || durationHrs <= 0) {
    fail(`durationHrs must be a finite number > 0 (got ${durationHrs}).`);
  }
  if (typeof dtSec !== 'number' || !Number.isFinite(dtSec) || dtSec <= 0) {
    fail(`dtSec must be a finite number > 0 (got ${dtSec}).`);
  }
}

/**
 * Discharge per unit width [ft^2/s] across the face between two cells,
 * positive from cell L toward cell R. Manning-based diffusion-wave flux:
 *   q = sign(S) * (1/n) * hFlow^(5/3) * sqrt(|S|)
 * with hFlow measured above the higher of the two bed elevations so that a
 * cell cannot drain through a face whose bed sits above its water surface.
 */
function faceFlux(
  zL: number, hL: number,
  zR: number, hR: number,
  dx: number, manningN: number,
): number {
  const etaL = zL + hL;
  const etaR = zR + hR;
  const hFlow = Math.max(etaL, etaR) - Math.max(zL, zR);
  if (hFlow <= 0) return 0;
  const slope = (etaL - etaR) / dx;
  const absSlope = Math.abs(slope);
  if (absSlope < SLOPE_FLOOR) return 0;
  const magnitude = (1 / manningN) * Math.pow(hFlow, 5 / 3) * Math.sqrt(absSlope);
  return slope > 0 ? magnitude : -magnitude;
}

/**
 * Explicit diffusive stability limit: dt <= dx^2 / (4 * D_max),
 * D = hFlow^(5/3) / (n * sqrt(|S|)). Evaluated on the initial state.
 * Faces with zero flow depth or zero slope impose no constraint.
 * Returns Infinity when no face constrains the step (e.g. dry flat domain).
 */
function maxStableDt(
  elevationFt: number[][], depthFt: number[][],
  nx: number, ny: number, dx: number, manningN: number,
): number {
  let dMax = 0;
  const consider = (zL: number, hL: number, zR: number, hR: number): void => {
    const etaL = zL + hL;
    const etaR = zR + hR;
    const hFlow = Math.max(etaL, etaR) - Math.max(zL, zR);
    if (hFlow <= 0) return;
    const absSlope = Math.abs((etaL - etaR) / dx);
    if (absSlope < SLOPE_FLOOR) return;
    const d = Math.pow(hFlow, 5 / 3) / (manningN * Math.sqrt(absSlope));
    if (d > dMax) dMax = d;
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (i + 1 < nx) consider(elevationFt[j][i], depthFt[j][i], elevationFt[j][i + 1], depthFt[j][i + 1]);
      if (j + 1 < ny) consider(elevationFt[j][i], depthFt[j][i], elevationFt[j + 1][i], depthFt[j + 1][i]);
    }
  }
  if (dMax <= 0) return Infinity;
  return (dx * dx) / (4 * dMax);
}

export function runDiffusionWave(input: DiffusionWaveInput, durationHrs: number, dtSec: number): DiffusionWaveOutput {
  validateInput(input, durationHrs, dtSec);

  const { nx, ny, dxFt: dx, elevationFt, manningN } = input;
  const rainFtPerSec = ((input.rainfallInPerHr ?? 0) / 12) / 3600;

  // Working depth grid (clamp initial negatives to 0; validated finite above).
  const h: number[][] = [];
  for (let j = 0; j < ny; j++) {
    const row: number[] = [];
    for (let i = 0; i < nx; i++) {
      const v = input.initialDepthFt ? input.initialDepthFt[j][i] : 0;
      row.push(v < 0 ? 0 : v);
    }
    h.push(row);
  }

  // Fail-closed diffusive stability check on the initial state.
  const dtMax = maxStableDt(elevationFt, h, nx, ny, dx, manningN);
  if (dtSec > dtMax) {
    fail(
      `dtSec=${dtSec} violates the explicit diffusive stability criterion ` +
      `dt <= dx^2/(4*D_max) = ${dtMax.toExponential(3)} s ` +
      `(D = h_flow^(5/3)/(n*sqrt(|S|)) over cell faces). Reduce dtSec.`,
    );
  }

  const totalSec = durationHrs * 3600;
  // Round the step count up so the adjusted per-step dt never exceeds the
  // user-supplied (stability-checked) dtSec.
  const nSteps = Math.max(1, Math.ceil(totalSec / dtSec));
  const dt = totalSec / nSteps;

  // Explicit update: h_new = h + dt * (rain - div(q)).
  for (let step = 0; step < nSteps; step++) {
    const next: number[][] = [];
    for (let j = 0; j < ny; j++) {
      const outRow: number[] = [];
      for (let i = 0; i < nx; i++) {
        // Closed (no-flux) domain edges: faces outside the grid carry no flow.
        const qW = i > 0 ? faceFlux(elevationFt[j][i - 1], h[j][i - 1], elevationFt[j][i], h[j][i], dx, manningN) : 0;
        const qE = i + 1 < nx ? faceFlux(elevationFt[j][i], h[j][i], elevationFt[j][i + 1], h[j][i + 1], dx, manningN) : 0;
        const qN = j > 0 ? faceFlux(elevationFt[j - 1][i], h[j - 1][i], elevationFt[j][i], h[j][i], dx, manningN) : 0;
        const qS = j + 1 < ny ? faceFlux(elevationFt[j][i], h[j][i], elevationFt[j + 1][i], h[j + 1][i], dx, manningN) : 0;
        const divQ = (qE - qW + qS - qN) / dx;
        let v = h[j][i] + dt * (rainFtPerSec - divQ);
        if (v < 0) v = 0; // clamp: depths never negative
        if (!Number.isFinite(v)) {
          fail(`non-finite depth at cell (${i},${j}) on step ${step}; aborting fail-closed.`);
        }
        outRow.push(v);
      }
      next.push(outRow);
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        h[j][i] = next[j][i];
      }
    }
  }

  const cellArea = dx * dx;
  let maxDepthFt = 0;
  let floodedCellCount = 0;
  let totalVolumeFt3 = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = h[j][i];
      if (v > maxDepthFt) maxDepthFt = v;
      if (v > FLOODED_EPS_FT) floodedCellCount++;
      totalVolumeFt3 += v * cellArea;
    }
  }

  return {
    depthFt: h,
    maxDepthFt,
    floodedCellCount,
    totalVolumeFt3,
    provenance: makeProvenance(['MODELED', 'DERIVED'], { modelVersion: MODEL_VERSION }),
  };
}
