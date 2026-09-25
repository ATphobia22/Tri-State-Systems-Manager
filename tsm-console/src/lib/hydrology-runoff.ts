import { makeProvenance, type Provenance } from './provenance-labels';

/**
 * hydrology-runoff.ts — SCS Curve Number rainfall-runoff hydrology module.
 *
 * ## Method (USDA NRCS TR-55, SCS Curve Number)
 *
 * For a watershed with Curve Number CN (dimensionless, 0 < CN <= 100):
 *
 *   S  = 1000 / CN - 10          (potential maximum retention, inches)
 *   Ia = 0.2 * S                 (initial abstraction, inches)
 *
 * Cumulative direct runoff Q (inches) for cumulative precipitation P (inches):
 *
 *   Q(P) = (P - Ia)^2 / (P - Ia + S)   when P > Ia
 *   Q(P) = 0                            when P <= Ia
 *
 * ## Hydrograph construction
 *
 * Input is a hyetograph: average rainfall intensity (in/hr) per interval.
 * `rainfallIntensityInPerHr[i]` is the average intensity over the interval
 * (rainfallTimeHrs[i], rainfallTimeHrs[i+1]]. The last intensity entry has no
 * following interval and is therefore unused.
 *
 *   P_i   = sum_{k=0}^{i-1} intensity[k] * (t[k+1] - t[k])   (cumulative rain, in)
 *   Q_i   = Q(P_i)                                          (cumulative runoff, in)
 *   dQ_i  = Q_i - Q_{i-1}                                   (incremental runoff, in)
 *   q_i   = (dQ_i / (t[i] - t[i-1])) * A * 645.33            (discharge, cfs)
 *
 * The discharge conversion: 1 in/hr of runoff over 1 sq mi equals
 * (1/12 ft/hr * 5280^2 ft^2) / 3600 s/hr = 645.333... cfs; the conventional
 * rounded factor 645.33 is used here.
 *
 * dischargeCfs[i] is the average discharge over the interval ending at
 * timeHrs[i]; dischargeCfs[0] = 0 (no interval ends at t[0]).
 * peakDischargeCfs = max(dischargeCfs); totalRunoffInches = Q at the final time.
 *
 * ## Units
 * - rainfallTimeHrs: hours
 * - rainfallIntensityInPerHr: inches per hour
 * - watershedAreaSqMi: square miles
 * - dischargeCfs: cubic feet per second
 * - totalRunoffInches: inches (runoff depth over the watershed)
 *
 * ## Assumptions
 * - Initial abstraction ratio Ia = 0.2 * S (standard TR-55 assumption).
 * - Lumped watershed: uniform CN and rainfall over the whole area.
 * - No channel routing, no baseflow, no interflow — runoff depth only.
 * - No infiltration after runoff begins beyond what S implies; no evapotranspiration.
 *
 * ## Limitations
 * - The CN method is event-based and empirical; it does not model soil moisture
 *   dynamics, antecedent conditions (AMC I/II/III are NOT adjusted for here),
 *   or snowmelt.
 * - Output is a lumped average discharge per timestep, NOT a routed hydrograph:
 *   there is no time-of-concentration, unit-hydrograph, or Muskingum routing.
 *   Do not use dischargeCfs as a routed flood wave without a routing model.
 * - Results are MODELLED/DERIVED estimates, not observations — see provenance.
 *
 * ## Validation (fail-closed)
 * computeSCSRunoff throws an Error on: CN outside (0, 100]; non-positive or
 * non-finite watershed area; empty or unequal-length time/intensity arrays;
 * non-finite or negative array values; times that are not strictly increasing.
 */

// Provenance labels are built with makeProvenance from './provenance-labels'
// (imported at the top of this file): ['MODELED', 'DERIVED'], modelVersion 'scs-cn-v1'.

/** Conversion: 1 in/hr of runoff over 1 sq mi = 645.33 cfs. */
export const IN_PER_HR_PER_SQMI_TO_CFS = 645.33;

/** Initial-abstraction ratio Ia = 0.2 * S (TR-55 standard). */
export const SCS_INITIAL_ABSTRACTION_RATIO = 0.2;

export interface SCSRunoffInput {
  /** Curve Number, dimensionless. Must satisfy 0 < CN <= 100. */
  curveNumber: number;
  /** Watershed area in square miles. Must be finite and > 0. */
  watershedAreaSqMi: number;
  /** Strictly increasing times in hours, length >= 1. */
  rainfallTimeHrs: number[];
  /** Average intensity (in/hr) over the interval starting at each time entry; same length as rainfallTimeHrs. */
  rainfallIntensityInPerHr: number[];
}

export interface SCSRunoffOutput {
  /** Copy of input times (hours). */
  timeHrs: number[];
  /** Average discharge (cfs) over the interval ending at each time; [0] = 0. */
  dischargeCfs: number[];
  /** Cumulative runoff depth (inches) at the final time. */
  totalRunoffInches: number;
  /** Maximum of dischargeCfs (cfs). */
  peakDischargeCfs: number;
  provenance: Provenance;
}

/** Cumulative SCS runoff depth Q (inches) for cumulative precipitation P (inches). */
function cumulativeRunoffInches(precipIn: number, initialAbstractionIn: number, retentionIn: number): number {
  if (precipIn <= initialAbstractionIn) {
    return 0;
  }
  const effective = precipIn - initialAbstractionIn;
  // retentionIn == 0 (CN = 100) reduces to Q = P, no division issue:
  // effective^2 / effective = effective, and precip = effective + Ia = effective.
  return (effective * effective) / (effective + retentionIn);
}

function requireFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`hydrology-runoff: ${name} must be a finite number, got ${String(value)}`);
  }
}

function validateInput(input: SCSRunoffInput): void {
  if (input === null || typeof input !== 'object') {
    throw new Error('hydrology-runoff: input must be an object');
  }
  requireFiniteNumber(input.curveNumber, 'curveNumber');
  if (input.curveNumber <= 0 || input.curveNumber > 100) {
    throw new Error(`hydrology-runoff: curveNumber must be in (0, 100], got ${input.curveNumber}`);
  }
  requireFiniteNumber(input.watershedAreaSqMi, 'watershedAreaSqMi');
  if (input.watershedAreaSqMi <= 0) {
    throw new Error(`hydrology-runoff: watershedAreaSqMi must be > 0, got ${input.watershedAreaSqMi}`);
  }
  const times = input.rainfallTimeHrs;
  const intensities = input.rainfallIntensityInPerHr;
  if (!Array.isArray(times) || !Array.isArray(intensities)) {
    throw new Error('hydrology-runoff: rainfallTimeHrs and rainfallIntensityInPerHr must be arrays');
  }
  if (times.length === 0 || intensities.length === 0) {
    throw new Error('hydrology-runoff: rainfallTimeHrs and rainfallIntensityInPerHr must be non-empty');
  }
  if (times.length !== intensities.length) {
    throw new Error(
      `hydrology-runoff: array length mismatch: rainfallTimeHrs has ${times.length}, rainfallIntensityInPerHr has ${intensities.length}`,
    );
  }
  for (let i = 0; i < times.length; i += 1) {
    requireFiniteNumber(times[i], `rainfallTimeHrs[${i}]`);
    if (times[i] < 0) {
      throw new Error(`hydrology-runoff: rainfallTimeHrs[${i}] must be non-negative, got ${times[i]}`);
    }
    requireFiniteNumber(intensities[i], `rainfallIntensityInPerHr[${i}]`);
    if (intensities[i] < 0) {
      throw new Error(`hydrology-runoff: rainfallIntensityInPerHr[${i}] must be non-negative, got ${intensities[i]}`);
    }
    if (i > 0 && times[i] <= times[i - 1]) {
      throw new Error(
        `hydrology-runoff: rainfallTimeHrs must be strictly increasing, got ${times[i - 1]} then ${times[i]}`,
      );
    }
  }
}

export function computeSCSRunoff(input: SCSRunoffInput): SCSRunoffOutput {
  validateInput(input);

  const { curveNumber, watershedAreaSqMi } = input;
  const times = input.rainfallTimeHrs;
  const intensities = input.rainfallIntensityInPerHr;

  const retentionIn = 1000 / curveNumber - 10;
  const initialAbstractionIn = SCS_INITIAL_ABSTRACTION_RATIO * retentionIn;

  const n = times.length;
  const dischargeCfs: number[] = new Array(n);
  let cumulativePrecipIn = 0;
  let prevCumulativeRunoffIn = 0;
  let peakDischargeCfs = 0;

  for (let i = 0; i < n; i += 1) {
    if (i > 0) {
      const dtHrs = times[i] - times[i - 1]; // > 0: validated strictly increasing
      cumulativePrecipIn += intensities[i - 1] * dtHrs;
      const cumulativeRunoffIn = cumulativeRunoffInches(cumulativePrecipIn, initialAbstractionIn, retentionIn);
      // Clamp tiny negative float residue; SCS cumulative runoff is monotone.
      const incrementalRunoffIn = Math.max(0, cumulativeRunoffIn - prevCumulativeRunoffIn);
      const runoffRateInPerHr = incrementalRunoffIn / dtHrs;
      const q = runoffRateInPerHr * watershedAreaSqMi * IN_PER_HR_PER_SQMI_TO_CFS;
      dischargeCfs[i] = q;
      if (q > peakDischargeCfs) {
        peakDischargeCfs = q;
      }
      prevCumulativeRunoffIn = cumulativeRunoffIn;
    } else {
      dischargeCfs[0] = 0;
    }
  }

  const provenance = makeProvenance(['MODELED', 'DERIVED'], {
    modelVersion: 'scs-cn-v1',
    retrievedAt: new Date().toISOString(),
  });

  return {
    timeHrs: [...times],
    dischargeCfs,
    totalRunoffInches: prevCumulativeRunoffIn,
    peakDischargeCfs,
    provenance,
  };
}
