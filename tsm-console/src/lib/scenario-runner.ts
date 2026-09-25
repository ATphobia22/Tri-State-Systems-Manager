/**
 * scenario-runner.ts — event-to-inundation scenario orchestration with alerting.
 *
 * ## Chain design
 *
 * A `ScenarioDefinition` chains the two already-implemented model stages:
 *
 *   1. Hydrology (optional): `computeSCSRunoff` (SCS Curve Number, scs-cn-v1)
 *      converts a hyetograph over a lumped watershed into a hydrograph.
 *   2. Hydraulics: `runDiffusionWave` (diffusion-wave-2d-v1) spreads water
 *      over a 2D elevation grid (closed boundaries, impermeable plane).
 *
 * The runner does not re-implement any physics; it orchestrates, couples,
 * validates inputs fail-closed, and evaluates alert thresholds.
 *
 * ## Rainfall -> grid coupling assumption (documented approximation)
 *
 * The SCS module is *lumped* (one CN, one runoff depth for the whole
 * watershed) while the diffusion-wave module wants a *spatially uniform*
 * rainfall rate on the grid. The runner converts:
 *
 *   rainfallInPerHr = totalRunoffInches / durationHrs
 *
 * i.e. the total event runoff depth is spread uniformly in space AND time
 * over the whole simulation. This is a deliberate, documented approximation:
 * it preserves total runoff *volume* per unit area (impermeable plane —
 * nothing is lost to infiltration on either side), but it discards the
 * hyetograph shape and any spatial heterogeneity. Results are therefore
 * conservative inundation *screening* estimates, not calibrated flood
 * predictions. Everything produced here is labeled MODELED + DERIVED.
 *
 * ## Alert semantics
 *
 * - Every threshold present in `alertThresholds` produces exactly one
 *   `AlertRecord`.
 * - `triggered: true`  iff observed metric >= threshold (metric is
 *   comparable and finite).
 * - `triggered: false` iff the metric was computed and is strictly below
 *   the threshold.
 * - `triggered: 'unknown'` with `observed: null` iff the metric could not
 *   be computed at all (e.g. a `peakDischargeCfs` rule when the scenario
 *   has no rainfall input, hence no SCS runoff). An unknown rule never
 *   silently reports `false`.
 * - Alert records are themselves modeled/derived products and carry
 *   provenance. Thresholds are non-negative and finite; violations of any
 *   validation rule throw (fail-closed).
 *
 * ## Not authoritative
 *
 * Scenario outputs are NOT observations and NOT FEMA-effective values. Do
 * not present max depths, flooded extents, or peak discharges as regulatory
 * or observed facts. See the three-separate-truths doctrine: computational
 * results are evidence only through the pipeline, never by assertion.
 */

import { computeSCSRunoff, type SCSRunoffOutput } from './hydrology-runoff';
import { runDiffusionWave, type DiffusionWaveOutput } from './hydraulics-diffusion2d';
import { makeProvenance, type Provenance } from './provenance-labels';

/** Model version stamped on scenario products (provenance only, not a claim). */
export const SCENARIO_RUNNER_VERSION = 'scenario-runner-v1';

export interface ScenarioRainfallInput {
  /** Hyetograph times in hours (strictly increasing, per computeSCSRunoff). */
  timeHrs: number[];
  /** Average intensity (in/hr) over the interval starting at each time entry. */
  intensityInPerHr: number[];
  /** SCS Curve Number, 0 < CN <= 100. */
  curveNumber: number;
  /** Watershed area in square miles, > 0. */
  watershedAreaSqMi: number;
}

export interface ScenarioGridInput {
  nx: number;
  ny: number;
  dxFt: number;
  /** Ground elevation in ft, indexed [row][col], ny rows x nx cols. */
  elevationFt: number[][];
  manningN: number;
}

export interface ScenarioDefinition {
  name: string;
  /** Optional rainfall event. Absent => dry (no-rainfall) scenario. */
  rainfall?: ScenarioRainfallInput;
  grid: ScenarioGridInput;
  /** Total scenario duration in hours (> 0). */
  durationHrs: number;
  /** Explicit timestep in seconds (> 0); stability-checked by the wave model. */
  dtSec: number;
  alertThresholds: {
    maxDepthFt?: number;
    floodedCellCount?: number;
    peakDischargeCfs?: number;
  };
}

export interface AlertRecord {
  /** Stable rule identifier, e.g. 'max-depth-ft'. */
  ruleId: string;
  /** Metric the rule evaluates, e.g. 'maxDepthFt'. */
  metric: string;
  threshold: number;
  /** Observed metric value; null when the metric could not be computed. */
  observed: number | null;
  /** true/false when evaluated; 'unknown' when not computable — never silently false. */
  triggered: boolean | 'unknown';
  /** ISO-8601 timestamp of evaluation. */
  evaluatedAt: string;
  provenance: Provenance;
}

export interface ScenarioResult {
  name: string;
  /** SCS hydrograph; present only when rainfall input was provided. */
  runoff?: SCSRunoffOutput;
  inundation: DiffusionWaveOutput;
  /** One record per threshold present in the definition. */
  alerts: AlertRecord[];
  provenance: Provenance;
}

function fail(message: string): never {
  throw new Error(`[scenario-runner] ${message}`);
}

function isPositiveInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

function requireNonNegativeFinite(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${name} must be a finite number >= 0 (got ${String(value)}).`);
  }
}

function validateDefinition(def: ScenarioDefinition): void {
  if (def === null || typeof def !== 'object') {
    fail('definition must be an object.');
  }
  if (typeof def.name !== 'string' || def.name.trim().length === 0) {
    fail('name must be a non-empty string.');
  }
  if (typeof def.durationHrs !== 'number' || !Number.isFinite(def.durationHrs) || def.durationHrs <= 0) {
    fail(`durationHrs must be a finite number > 0 (got ${String(def.durationHrs)}).`);
  }
  if (typeof def.dtSec !== 'number' || !Number.isFinite(def.dtSec) || def.dtSec <= 0) {
    fail(`dtSec must be a finite number > 0 (got ${String(def.dtSec)}).`);
  }
  const grid = def.grid;
  if (grid === null || typeof grid !== 'object') {
    fail('grid must be an object.');
  }
  if (!isPositiveInteger(grid.nx)) fail(`grid.nx must be a positive integer (got ${String(grid.nx)}).`);
  if (!isPositiveInteger(grid.ny)) fail(`grid.ny must be a positive integer (got ${String(grid.ny)}).`);
  if (typeof grid.dxFt !== 'number' || !Number.isFinite(grid.dxFt) || grid.dxFt <= 0) {
    fail(`grid.dxFt must be a finite number > 0 (got ${String(grid.dxFt)}).`);
  }
  if (typeof grid.manningN !== 'number' || !Number.isFinite(grid.manningN) || grid.manningN <= 0) {
    fail(`grid.manningN must be a finite number > 0 (got ${String(grid.manningN)}).`);
  }
  // Grid dims consistent: the diffusion-wave model validates again, but the
  // runner validates early so a malformed scenario fails here, not mid-chain.
  if (!Array.isArray(grid.elevationFt) || grid.elevationFt.length !== grid.ny) {
    fail(
      `grid.elevationFt must have exactly ny=${grid.ny} rows (got ` +
        `${Array.isArray(grid.elevationFt) ? grid.elevationFt.length : 'non-array'}).`,
    );
  }
  for (let j = 0; j < grid.ny; j += 1) {
    const row = grid.elevationFt[j];
    if (!Array.isArray(row) || row.length !== grid.nx) {
      fail(`grid.elevationFt row ${j} must have exactly nx=${grid.nx} columns.`);
    }
  }
  const thresholds = def.alertThresholds;
  if (thresholds === null || typeof thresholds !== 'object') {
    fail('alertThresholds must be an object.');
  }
  if (thresholds.maxDepthFt !== undefined) requireNonNegativeFinite(thresholds.maxDepthFt, 'alertThresholds.maxDepthFt');
  if (thresholds.floodedCellCount !== undefined) {
    requireNonNegativeFinite(thresholds.floodedCellCount, 'alertThresholds.floodedCellCount');
  }
  if (thresholds.peakDischargeCfs !== undefined) {
    requireNonNegativeFinite(thresholds.peakDischargeCfs, 'alertThresholds.peakDischargeCfs');
  }
  // Rainfall shape is validated by computeSCSRunoff itself (fail-closed there).
}

/**
 * Converts total SCS runoff depth (inches) into a uniform grid rainfall rate
 * (in/hr) spread over the whole scenario duration.
 *
 * Documented approximation: uniform in space AND time; preserves total
 * runoff volume per unit area on the impermeable plane.
 */
function uniformRainfallRateInPerHr(totalRunoffInches: number, durationHrs: number): number {
  // durationHrs > 0 is validated before this is called.
  return Math.max(0, totalRunoffInches) / durationHrs;
}

function scenarioProvenance(): Provenance {
  return makeProvenance(['MODELED', 'DERIVED'], { modelVersion: SCENARIO_RUNNER_VERSION });
}

function evaluateRule(
  ruleId: string,
  metric: string,
  threshold: number,
  observed: number | null,
): AlertRecord {
  return {
    ruleId,
    metric,
    threshold,
    observed,
    triggered: observed === null ? 'unknown' : observed >= threshold,
    evaluatedAt: new Date().toISOString(),
    provenance: scenarioProvenance(),
  };
}

export function runScenario(def: ScenarioDefinition): ScenarioResult {
  validateDefinition(def);

  // Stage 1 — hydrology (optional). Throws fail-closed on malformed rainfall.
  let runoff: SCSRunoffOutput | undefined;
  let rainfallInPerHr: number | undefined;
  if (def.rainfall !== undefined) {
    runoff = computeSCSRunoff({
      curveNumber: def.rainfall.curveNumber,
      watershedAreaSqMi: def.rainfall.watershedAreaSqMi,
      rainfallTimeHrs: def.rainfall.timeHrs,
      rainfallIntensityInPerHr: def.rainfall.intensityInPerHr,
    });
    rainfallInPerHr = uniformRainfallRateInPerHr(runoff.totalRunoffInches, def.durationHrs);
  }

  // Stage 2 — hydraulics over the grid.
  const inundation: DiffusionWaveOutput = runDiffusionWave(
    {
      nx: def.grid.nx,
      ny: def.grid.ny,
      dxFt: def.grid.dxFt,
      elevationFt: def.grid.elevationFt,
      manningN: def.grid.manningN,
      ...(rainfallInPerHr !== undefined ? { rainfallInPerHr } : {}),
    },
    def.durationHrs,
    def.dtSec,
  );

  // Stage 3 — alert evaluation. One record per threshold present.
  const alerts: AlertRecord[] = [];
  const t = def.alertThresholds;
  if (t.maxDepthFt !== undefined) {
    alerts.push(evaluateRule('max-depth-ft', 'maxDepthFt', t.maxDepthFt, inundation.maxDepthFt));
  }
  if (t.floodedCellCount !== undefined) {
    alerts.push(evaluateRule('flooded-cells', 'floodedCellCount', t.floodedCellCount, inundation.floodedCellCount));
  }
  if (t.peakDischargeCfs !== undefined) {
    // No rainfall input => no SCS hydrograph => peak discharge not computable.
    // Report 'unknown', never silently false.
    const observed = runoff === undefined ? null : runoff.peakDischargeCfs;
    alerts.push(evaluateRule('peak-discharge-cfs', 'peakDischargeCfs', t.peakDischargeCfs, observed));
  }

  return {
    name: def.name,
    ...(runoff !== undefined ? { runoff } : {}),
    inundation,
    alerts,
    provenance: scenarioProvenance(),
  };
}
