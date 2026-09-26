/**
 * engine.ts — deterministic fixed-timestep flood simulation engine.
 *
 * Pipeline (all wired, not rewritten):
 *   hyetograph → computeSCSRunoff (hydrology-runoff.ts)
 *             → runDiffusionWave   (hydraulics-diffusion2d.ts)
 *             → computeFloodDamage (hazus-depth-damage.ts)
 *
 * ## Time model
 * The engine advances sim-time in FIXED quanta of 1/60 sim-second
 * (ENGINE_STEP_HZ = 60). Rendering is decoupled: the host (React component)
 * accumulates wall-clock time in the classic fixed-timestep accumulator and
 * calls `advance(wallDt * timeScale)`; the engine consumes whole quanta and
 * banks any remainder for the next call. Given the same seed + inputs +
 * call sequence, two runs are bit-identical (see `stateHash()`).
 *
 * ## SCS → wave coupling (screening-level, documented assumption)
 * The scenario hyetograph drives `computeSCSRunoff` at init (fail-closed
 * validation + watershed totals). The cumulative runoff curve is sampled at
 * the hyetograph nodes; SCS runoff is then re-applied to the wave model as a
 * uniform rainfall rate (in/hr) over each fixed quantum. This is a
 * conservative screening-level coupling: it assumes the modeled domain
 * coincides with the watershed footprint and that runoff arrives uniformly.
 * The hyetograph rain is NOT also fed to the wave model (that would
 * double-count — the SCS depth already derives from it). Screening-level
 * only: not a calibrated hydrologic model.
 *
 * ## One water-advance path (bit-identity)
 * Both single stepping and bulk fast-forward go through `advanceWater(a,b)`
 * — one `runDiffusionWave` call per node-interval chunk with a constant
 * rainfall rate. Because the SCS increment per quantum is constant within a
 * node interval, a bulk chunk of N quanta performs exactly the same
 * floating-point operations in the same order as N single steps
 * (verified: totalSec/dtSec is exactly integral, so the module's internal
 * `dt` adjustment is a no-op). Scrubbing to t therefore reproduces direct
 * stepping to t bit-for-bit.
 *
 * ## Fail-closed rules
 * - Non-finite / out-of-range config → throw at construction.
 * - The 1/60 s quantum is probe-checked against the diffusion-wave explicit
 *   stability limit at construction: if dt violates dx²/(4·D_max) the engine
 *   refuses to construct (the underlying module throws; we surface it).
 * - `step()` / `advance()` are no-ops while paused; `setTime()` clamps to
 *   [0, duration] and restores from the snapshot ring buffer.
 *
 * ## Provenance
 * Every engine output carries `provenance: 'simulation'` (the repo's shared
 * taxonomy labels this MODELED + DERIVED; the engine-level string is the
 * plain-language layer name used across the flood-sim UI and docs).
 */

import { computeSCSRunoff, type SCSRunoffOutput } from '../hydrology-runoff';
import { runDiffusionWave } from '../hydraulics-diffusion2d';
import { computeFloodDamage, type DamageOutput, type OccupancyType } from '../hazus-depth-damage';
import { mulberry32, type Mulberry32 } from './prng';

/** Fixed engine cadence: 60 quanta per sim-second. */
export const ENGINE_STEP_HZ = 60;
/** Sim-seconds advanced per engine quantum. */
export const STEP_DT_SEC = 1 / ENGINE_STEP_HZ;
/**
 * Max quanta per wired wave-model call (1 sim-hour). The module's internal
 * `dt = totalSec / ceil(totalSec/dtSec)` is verified bit-equal to
 * STEP_DT_SEC for chunk sizes ≤ 432000; the cap keeps bulk fast-forward
 * bit-identical to per-quantum stepping.
 */
export const MAX_CHUNK_QUANTA = ENGINE_STEP_HZ * 3600;
/** Engine model version stamped on provenance records. */
export const FLOOD_SIM_ENGINE_VERSION = 'flood-sim-engine-v1';
/** Plain-language provenance label applied to every engine output. */
export const SIMULATION_PROVENANCE = 'simulation' as const;
export type SimulationProvenance = typeof SIMULATION_PROVENANCE;

/** A structure exposed to flood depth for Hazus damage evaluation. */
export interface EngineStructure {
  /** Stable structure id (e.g. 'bonebank-farmstead'). */
  id: string;
  /** Human label for UI. */
  name: string;
  occupancyType: OccupancyType;
  /** Grid cell indices locating the structure on the depth grid. */
  cellRow: number;
  cellCol: number;
  /** First-floor elevation, ft NAVD88 (or consistent datum). */
  firstFloorElevFt: number;
  structureValueUsd: number;
  contentsValueUsd?: number;
}

export interface FloodSimEngineConfig {
  scenarioId: string;
  /** Deterministic seed (uint32). Same seed + same config ⇒ bit-identical run. */
  seed: number;
  nx: number;
  ny: number;
  dxFt: number;
  /** Ground elevation ft, [row][col], ny × nx. The engine copies it. */
  elevationFt: number[][];
  manningN: number;
  /** Hyetograph: strictly increasing hours; intensity in/hr per interval start. */
  rainfallTimeHrs: number[];
  rainfallIntensityInPerHr: number[];
  /** SCS watershed parameters. */
  curveNumber: number;
  watershedAreaSqMi: number;
  /** Total scenario duration, hours. */
  durationHrs: number;
  structures?: EngineStructure[];
  /** Snapshot cadence in engine quanta (default: 3600 = 1 sim-minute). */
  snapshotEverySteps?: number;
  /** Ring-buffer capacity (default 512 snapshots). */
  snapshotCapacity?: number;
}

export interface EngineDamageRecord {
  structureId: string;
  structureName: string;
  occupancyType: OccupancyType;
  depthAboveFirstFloorFt: number;
  damage: DamageOutput;
  provenance: SimulationProvenance;
}

export interface EngineSnapshot {
  /** Integer quantum index. */
  stepIndex: number;
  simTimeSec: number;
  depthFt: number[][];
  cumulativeRunoffIn: number;
}

function fail(message: string): never {
  throw new Error(`[flood-sim-engine] ${message}`);
}

/** FNV-1a 64-bit over a string, returned as 16 lowercase hex chars. */
function fnv1a64Hex(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i += 1) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Deterministic JSON: object keys sorted recursively, arrays in order,
 * numbers via String(n) (full double precision, no locale). Equivalent to
 * Python's json.dumps(sort_keys=True) for JSON-safe values.
 */
export function deterministicJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('deterministicJson: non-finite number');
      return String(value);
    }
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(deterministicJson).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${deterministicJson((value as Record<string, unknown>)[k])}`);
  return `{${parts.join(',')}}`;
}

export class FloodSimEngine {
  readonly config: Readonly<FloodSimEngineConfig>;
  readonly provenance: SimulationProvenance = SIMULATION_PROVENANCE;
  readonly engineVersion = FLOOD_SIM_ENGINE_VERSION;

  private readonly prng: Mulberry32;
  private readonly elevationFt: number[][];
  private depthFt: number[][];
  private stepIndex = 0;
  private paused = false;
  private remainderSec = 0;

  /**
   * SCS runoff sampled at hyetograph nodes, quantized to whole engine
   * quanta: nodeQuantum[k] (integer) ↔ nodeRunoffIn[k] (inches, from the
   * wired module). Between nodes the per-quantum increment is constant,
   * which is what makes bulk fast-forward bit-identical to single steps.
   */
  private readonly nodeQuantum: number[];
  private readonly nodeRunoffIn: number[];
  private readonly scsTotals: SCSRunoffOutput;
  /** Operator override for live gauge-driven scenarios (in/hr, constant). Null = hyetograph. */
  private rainfallOverrideInPerHr: number | null = null;

  private readonly snapshotEverySteps: number;
  private readonly snapshots: EngineSnapshot[] = [];
  private readonly snapshotCapacity: number;

  constructor(config: FloodSimEngineConfig) {
    validateConfig(config);
    this.config = Object.freeze({ ...config });
    this.prng = mulberry32(config.seed >>> 0);
    this.elevationFt = config.elevationFt.map((row) => [...row]);
    this.depthFt = config.elevationFt.map((row) => row.map(() => 0));
    this.snapshotEverySteps = config.snapshotEverySteps ?? ENGINE_STEP_HZ * 60;
    this.snapshotCapacity = config.snapshotCapacity ?? 512;

    // --- SCS stage (wired): validate + sample the cumulative runoff curve.
    this.scsTotals = computeSCSRunoff({
      curveNumber: config.curveNumber,
      watershedAreaSqMi: config.watershedAreaSqMi,
      rainfallTimeHrs: config.rainfallTimeHrs,
      rainfallIntensityInPerHr: config.rainfallIntensityInPerHr,
    });
    const nodes = sampleRunoffNodes(config);
    this.nodeQuantum = nodes.quantum;
    this.nodeRunoffIn = nodes.runoffIn;

    // --- Fail-closed stability probe: the fixed 1/60 s quantum must satisfy
    // --- the diffusion-wave explicit limit, or the engine refuses to run.
    // runDiffusionWave throws on violation — we let it propagate with context.
    try {
      runDiffusionWave(
        {
          nx: config.nx,
          ny: config.ny,
          dxFt: config.dxFt,
          elevationFt: this.elevationFt,
          manningN: config.manningN,
          initialDepthFt: this.depthFt,
          rainfallInPerHr: 0,
        },
        STEP_DT_SEC / 3600,
        STEP_DT_SEC,
      );
    } catch (err) {
      fail(
        `fixed ${STEP_DT_SEC}s quantum violates the diffusion-wave stability limit for this grid ` +
          `(dx=${config.dxFt} ft, manningN=${config.manningN}). ` +
          `Coarsen the grid, raise manningN, or flatten slopes. Underlying: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.takeSnapshot(); // step 0 baseline
  }

  // -- time control ---------------------------------------------------------

  /** Sim-time in seconds. */
  get simTimeSec(): number {
    return this.stepIndex * STEP_DT_SEC;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /**
   * Advance by dtSec (default: exactly one fixed quantum). dtSec is consumed
   * in whole 1/60 s quanta; any leftover < 1 quantum is banked and applied
   * on the next call, so the trajectory depends only on the total advanced
   * time, never on how calls were chunked. No-op while paused.
   * @returns number of quanta actually advanced.
   */
  step(dtSec: number = STEP_DT_SEC): number {
    if (this.paused) return 0;
    if (typeof dtSec !== 'number' || !Number.isFinite(dtSec) || dtSec < 0) {
      fail(`step(dtSec) requires a finite number >= 0 (got ${dtSec})`);
    }
    const total = this.remainderSec + dtSec;
    const quanta = Math.floor(total / STEP_DT_SEC + 1e-9);
    this.remainderSec = total - quanta * STEP_DT_SEC;
    // Guard against float dust.
    if (this.remainderSec < 1e-12) this.remainderSec = 0;
    if (quanta > 0) {
      this.advanceQuanta(this.stepIndex + quanta);
    }
    return quanta;
  }

  /**
   * Jump the timeline to sim-time tSec (clamped to [0, duration]).
   * Restores the nearest snapshot at or before t, then fast-forwards —
   * bit-identical to having stepped there directly (single water-advance
   * path; see header). Cost scales with the scrub distance; the snapshot
   * ring buffer keeps short scrubs cheap.
   */
  setTime(tSec: number): void {
    if (typeof tSec !== 'number' || !Number.isFinite(tSec)) {
      fail(`setTime requires a finite number (got ${tSec})`);
    }
    const durationQuanta = Math.round((this.config.durationHrs * 3600) / STEP_DT_SEC);
    const targetIndex = Math.min(Math.max(Math.round(tSec / STEP_DT_SEC), 0), durationQuanta);

    let best: EngineSnapshot | null = null;
    for (const snap of this.snapshots) {
      if (snap.stepIndex <= targetIndex && (best === null || snap.stepIndex > best.stepIndex)) {
        best = snap;
      }
    }
    if (best === null) fail('setTime: no snapshot available (engine misconfigured)');
    this.restoreSnapshot(best);
    const wasPaused = this.paused;
    this.paused = false;
    this.advanceQuanta(targetIndex);
    this.paused = wasPaused;
  }

  // -- state access ----------------------------------------------------------

  /** Deep copy of the current depth grid (ft), [row][col]. */
  getDepthGrid(): number[][] {
    return this.depthFt.map((row) => [...row]);
  }

  /** Copy of the elevation grid (ft NAVD88 or consistent datum). */
  getElevationGrid(): number[][] {
    return this.elevationFt.map((row) => [...row]);
  }

  /** Maximum depth over the grid right now (ft). */
  getMaxDepthFt(): number {
    let max = 0;
    for (const row of this.depthFt) {
      for (const v of row) {
        if (v > max) max = v;
      }
    }
    return max;
  }

  /** SCS watershed totals for the scenario hyetograph (in/hr → cfs diagnostics). */
  getScsTotals(): SCSRunoffOutput {
    return this.scsTotals;
  }

  /** Cumulative SCS runoff depth (inches) realized so far. */
  getCumulativeRunoffIn(): number {
    return this.cumulativeRunoffAtQuantum(this.stepIndex);
  }

  /**
   * Operator-supplied rainfall override (in/hr, constant) for live
   * gauge-driven scenarios. Null restores the scenario hyetograph.
   * Recorded in the hash input so overrides are reproducible.
   */
  overrideRainfallIntensity(inPerHr: number | null): void {
    if (inPerHr !== null && (typeof inPerHr !== 'number' || !Number.isFinite(inPerHr) || inPerHr < 0)) {
      fail(`overrideRainfallIntensity requires a finite number >= 0 or null (got ${inPerHr})`);
    }
    this.rainfallOverrideInPerHr = inPerHr;
  }

  /** Hazus-compatible damage for every configured structure at current depth. */
  getDamageReport(): EngineDamageRecord[] {
    const structures = this.config.structures ?? [];
    return structures.map((s) => {
      const depth = this.depthFt[s.cellRow]?.[s.cellCol] ?? 0;
      const wse = this.elevationFt[s.cellRow][s.cellCol] + depth;
      const depthAboveFF = wse - s.firstFloorElevFt;
      const damage = computeFloodDamage({
        occupancyType: s.occupancyType,
        depthFt: Math.max(0, depthAboveFF),
        structureValueUsd: s.structureValueUsd,
        contentsValueUsd: s.contentsValueUsd,
      });
      return {
        structureId: s.id,
        structureName: s.name,
        occupancyType: s.occupancyType,
        depthAboveFirstFloorFt: depthAboveFF,
        damage,
        provenance: SIMULATION_PROVENANCE,
      };
    });
  }

  /**
   * Deterministic state fingerprint: lowercase hex over canonical JSON of
   * {version, scenarioId, seed, stepIndex, depth grid}. Two runs with the
   * same seed + inputs + step sequence produce identical hashes.
   */
  stateHash(): string {
    const payload = {
      version: FLOOD_SIM_ENGINE_VERSION,
      scenarioId: this.config.scenarioId,
      seed: this.config.seed >>> 0,
      stepIndex: this.stepIndex,
      depthFt: this.depthFt,
      rainfallOverrideInPerHr: this.rainfallOverrideInPerHr,
    };
    return fnv1a64Hex(deterministicJson(payload));
  }

  /** Number of snapshots currently retained. */
  getSnapshotCount(): number {
    return this.snapshots.length;
  }

  // -- internals ---------------------------------------------------------------

  /**
   * Advance the water model from the current quantum to targetQuantum
   * (target > current). Splits at hyetograph-node boundaries (where the
   * per-quantum runoff increment changes), at snapshot multiples, and at
   * MAX_CHUNK_QUANTA (keeps the wired module's internal dt bit-exact —
   * verified float-exact for N ≤ 432000; we cap at 216000 = 1 sim-hour),
   * so each chunk has a CONSTANT rainfall rate and snapshots land exactly
   * where direct stepping would take them.
   */
  private advanceQuanta(targetQuantum: number): void {
    if (!Number.isInteger(targetQuantum) || targetQuantum < this.stepIndex) {
      fail(`advanceQuanta requires an integer target >= current (got ${targetQuantum})`);
    }
    while (this.stepIndex < targetQuantum) {
      let nextStop = targetQuantum;
      // Next node boundary strictly after the current quantum.
      for (const k of this.nodeQuantum) {
        if (k > this.stepIndex && k < nextStop) nextStop = k;
      }
      // Next snapshot multiple strictly after the current quantum.
      const snap = this.snapshotEverySteps;
      const nextSnap = (Math.floor(this.stepIndex / snap) + 1) * snap;
      if (nextSnap > this.stepIndex && nextSnap < nextStop) nextStop = nextSnap;
      // Cap chunk size for bit-exact internal dt in the wired module.
      if (nextStop - this.stepIndex > MAX_CHUNK_QUANTA) {
        nextStop = this.stepIndex + MAX_CHUNK_QUANTA;
      }
      this.advanceWaterChunk(this.stepIndex, nextStop);
      this.stepIndex = nextStop;
      if (this.stepIndex % this.snapshotEverySteps === 0) {
        this.takeSnapshot();
      }
    }
  }

  /**
   * THE single water-advance path. Advances quanta [fromQuantum, toQuantum)
   * with a constant rainfall rate derived from the per-quantum SCS increment
   * (closed form — identical value whether called for 1 quantum or N).
   * One wired runDiffusionWave call; its internal substep count is exactly
   * (toQuantum - fromQuantum) with dt bit-equal to STEP_DT_SEC, so this is
   * bit-identical to single-quantum stepping.
   */
  private advanceWaterChunk(fromQuantum: number, toQuantum: number): void {
    const n = toQuantum - fromQuantum;
    if (n <= 0) return;
    if (n > MAX_CHUNK_QUANTA) {
      fail(`advanceWaterChunk: chunk of ${n} quanta exceeds MAX_CHUNK_QUANTA`);
    }
    const rateInPerHr = this.quantumIncrementIn(fromQuantum) / STEP_DT_SEC * 3600;
    const out = runDiffusionWave(
      {
        nx: this.config.nx,
        ny: this.config.ny,
        dxFt: this.config.dxFt,
        elevationFt: this.elevationFt,
        manningN: this.config.manningN,
        initialDepthFt: this.depthFt,
        rainfallInPerHr: rateInPerHr,
      },
      (n * STEP_DT_SEC) / 3600,
      STEP_DT_SEC,
    );
    this.depthFt = out.depthFt;
  }

  /**
   * SCS runoff increment (inches) for the single quantum starting at
   * quantum index n. Constant within a node interval by construction.
   */
  private quantumIncrementIn(n: number): number {
    if (this.rainfallOverrideInPerHr !== null) {
      return (this.rainfallOverrideInPerHr / 3600) * STEP_DT_SEC;
    }
    const k = this.nodeQuantum;
    const q = this.nodeRunoffIn;
    if (n < k[0]) return 0;
    for (let i = 0; i < k.length - 1; i += 1) {
      if (n < k[i + 1]) {
        const span = k[i + 1] - k[i];
        return span === 0 ? 0 : (q[i + 1] - q[i]) / span;
      }
    }
    return 0;
  }

  /** Cumulative SCS runoff (inches) at an integer quantum index. */
  private cumulativeRunoffAtQuantum(n: number): number {
    if (this.rainfallOverrideInPerHr !== null) {
      return (this.rainfallOverrideInPerHr / 3600) * (n * STEP_DT_SEC);
    }
    const k = this.nodeQuantum;
    const q = this.nodeRunoffIn;
    if (n <= k[0]) return q[0];
    const last = k.length - 1;
    if (n >= k[last]) return q[last];
    for (let i = 0; i < last; i += 1) {
      if (n < k[i + 1]) {
        const span = k[i + 1] - k[i];
        const f = span === 0 ? 0 : (n - k[i]) / span;
        return q[i] + f * (q[i + 1] - q[i]);
      }
    }
    return q[last];
  }

  private takeSnapshot(): void {
    this.snapshots.push({
      stepIndex: this.stepIndex,
      simTimeSec: this.simTimeSec,
      depthFt: this.depthFt.map((row) => [...row]),
      cumulativeRunoffIn: this.cumulativeRunoffAtQuantum(this.stepIndex),
    });
    while (this.snapshots.length > this.snapshotCapacity) {
      this.snapshots.shift();
    }
  }

  private restoreSnapshot(snap: EngineSnapshot): void {
    this.stepIndex = snap.stepIndex;
    this.depthFt = snap.depthFt.map((row) => [...row]);
    this.remainderSec = 0;
  }
}

/**
 * Sample the SCS cumulative runoff curve at the hyetograph nodes by calling
 * the wired module on successively truncated hyetographs (M+1 calls,
 * M = number of intervals — cheap at init, never per-step). Node times are
 * quantized to whole engine quanta; sub-quantum node collisions are merged.
 */
function sampleRunoffNodes(config: FloodSimEngineConfig): { quantum: number[]; runoffIn: number[] } {
  const quantum: number[] = [0];
  const runoffIn: number[] = [0];
  const t = config.rainfallTimeHrs;
  const inten = config.rainfallIntensityInPerHr;
  for (let k = 1; k < t.length; k += 1) {
    const out = computeSCSRunoff({
      curveNumber: config.curveNumber,
      watershedAreaSqMi: config.watershedAreaSqMi,
      rainfallTimeHrs: t.slice(0, k + 1),
      rainfallIntensityInPerHr: inten.slice(0, k + 1),
    });
    const qk = Math.round((t[k] * 3600) / STEP_DT_SEC);
    if (qk <= quantum[quantum.length - 1]) {
      // Sub-quantum node collision: keep the later (more complete) sample.
      quantum[quantum.length - 1] = qk;
      runoffIn[runoffIn.length - 1] = out.totalRunoffInches;
    } else {
      quantum.push(qk);
      runoffIn.push(out.totalRunoffInches);
    }
  }
  return { quantum, runoffIn };
}

function validateConfig(config: FloodSimEngineConfig): void {
  if (config === null || typeof config !== 'object') fail('config must be an object');
  if (typeof config.scenarioId !== 'string' || config.scenarioId.length === 0) {
    fail('scenarioId must be a non-empty string');
  }
  if (typeof config.seed !== 'number' || !Number.isFinite(config.seed)) fail('seed must be a finite number');
  if (!Number.isInteger(config.nx) || config.nx <= 0) fail('nx must be a positive integer');
  if (!Number.isInteger(config.ny) || config.ny <= 0) fail('ny must be a positive integer');
  if (typeof config.dxFt !== 'number' || !Number.isFinite(config.dxFt) || config.dxFt <= 0) {
    fail('dxFt must be finite and > 0');
  }
  if (typeof config.manningN !== 'number' || !Number.isFinite(config.manningN) || config.manningN <= 0) {
    fail('manningN must be finite and > 0');
  }
  if (typeof config.durationHrs !== 'number' || !Number.isFinite(config.durationHrs) || config.durationHrs <= 0) {
    fail('durationHrs must be finite and > 0');
  }
  const elev = config.elevationFt;
  if (!Array.isArray(elev) || elev.length !== config.ny) fail('elevationFt must have ny rows');
  for (let j = 0; j < config.ny; j += 1) {
    const row = elev[j];
    if (!Array.isArray(row) || row.length !== config.nx) fail(`elevationFt row ${j} must have nx columns`);
    for (let i = 0; i < config.nx; i += 1) {
      if (typeof row[i] !== 'number' || !Number.isFinite(row[i])) fail(`elevationFt[${j}][${i}] must be finite`);
    }
  }
  for (const s of config.structures ?? []) {
    if (!Number.isInteger(s.cellRow) || s.cellRow < 0 || s.cellRow >= config.ny) {
      fail(`structure ${s.id}: cellRow out of range`);
    }
    if (!Number.isInteger(s.cellCol) || s.cellCol < 0 || s.cellCol >= config.nx) {
      fail(`structure ${s.id}: cellCol out of range`);
    }
    if (typeof s.firstFloorElevFt !== 'number' || !Number.isFinite(s.firstFloorElevFt)) {
      fail(`structure ${s.id}: firstFloorElevFt must be finite`);
    }
  }
  // Hyetograph shape is validated fail-closed by computeSCSRunoff at init.
}
