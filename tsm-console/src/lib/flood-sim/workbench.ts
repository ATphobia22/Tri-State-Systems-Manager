/**
 * workbench.ts — engineering workbench tools for the flood simulator.
 *
 * Pure functions + documented component hooks. NOTHING here applies an
 * engineering change by itself: every alternative returns a parameter set
 * that is inform-only until a human explicitly signs off in the UI
 * (checkbox/confirm in FloodSimulator.tsx). The governing axiom applies:
 * "Technology informs people; it does not silently govern people.
 *  Human authority remains final."
 *
 * Stage mapping: alternative toggles are mapped to the 10-stage evaluation
 * pipeline's Stage 6 (Evaluate Statutory Compliance) and Stage 7 (Evaluate
 * Funding/Grant Eligibility) as INFORM-ONLY inputs — i.e. "what would this
 * alternative imply for compliance/grant deliberation". Reference:
 * docs/archive/drive-import/tristate-twin-all-code.md (Stage 6/10, 7/10).
 *
 * Datum rule (gated here, enforced in UI):
 *   WSE_NAVD88 = gage_height_source + gage_zero_NAVD88_validated, ONLY when
 *   a validated gage zero exists. Otherwise the readout is the literal
 *   string "SOURCE DATUM ONLY" — never a fabricated NAVD88 number.
 */

import { BONEBANK_SITE_CONSTANTS } from '../scientific-analytics';

export type SiteConstants = typeof BONEBANK_SITE_CONSTANTS;

/** How a value was derived — arithmetic on owner constants is not a survey. */
export const ARITHMETIC_NOT_SURVEY = 'arithmetic-not-survey' as const;

export interface LagBfeProbeResult {
  /** Lowest adjacent grade minus base flood elevation (ft). Positive = freeboard. */
  lagMinusBfeFt: number;
  /** Finished floor elevation minus BFE (ft). */
  ffeMinusBfeFt: number;
  /** Berm crest minus BFE (ft). */
  bermMinusBfeFt: number;
  derivation: typeof ARITHMETIC_NOT_SURVEY;
  provenance: 'simulation';
  note: string;
}

/**
 * Freeboard arithmetic probe at a site. Pure subtraction on the supplied
 * site constants — labeled arithmetic-not-survey, NOT a field survey and
 * NOT a certification of floodplain status.
 */
export function lagBfeProbe(
  lat: number,
  lng: number,
  siteConstants: SiteConstants = BONEBANK_SITE_CONSTANTS,
): LagBfeProbeResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('[flood-sim-workbench] lagBfeProbe: lat/lng must be finite numbers');
  }
  return {
    lagMinusBfeFt: siteConstants.LAG - siteConstants.BFE,
    ffeMinusBfeFt: siteConstants.FFE - siteConstants.BFE,
    bermMinusBfeFt: siteConstants.BERM - siteConstants.BFE,
    derivation: ARITHMETIC_NOT_SURVEY,
    provenance: 'simulation',
    note:
      'Arithmetic on owner-supplied site constants only (BFE 375.0 / LAG 377.2 / FFE 382.5 / BERM 379.8 ft NAVD88). ' +
      'Not a survey, not a FEMA determination. Human review required before any use.',
  };
}

// ---------------------------------------------------------------------------
// Mitigation-alternative parameter sets (inform-only)
// ---------------------------------------------------------------------------

export type AlternativeId = 'no-action' | 'berm-raise-1ft' | 'berm-raise-2ft' | 'channel-dredge-2ft';

export interface AlternativeSpec {
  id: AlternativeId;
  name: string;
  description: string;
  /** Evidence-pipeline stages this alternative informs (inform-only). */
  informsStages: ReadonlyArray<'stage-6-statutory-compliance' | 'stage-7-grant-eligibility'>;
  /**
   * Engine parameter deltas applied ONLY after explicit human sign-off.
   * bermRaiseFt: added to cells flagged as berm (raises ground elevation).
   * dredgeDepthFt: subtracted from cells flagged as channel (lowers ground).
   * manningNDelta: roughness change (e.g. cleared channel).
   */
  paramDeltas: {
    bermRaiseFt: number;
    dredgeDepthFt: number;
    manningNDelta: number;
  };
  requiresHumanSignoff: true;
  provenance: 'simulation';
}

export const MITIGATION_ALTERNATIVES: ReadonlyArray<AlternativeSpec> = [
  {
    id: 'no-action',
    name: 'No action (baseline)',
    description: 'Existing conditions. Baseline against which alternatives are compared.',
    informsStages: ['stage-6-statutory-compliance', 'stage-7-grant-eligibility'],
    paramDeltas: { bermRaiseFt: 0, dredgeDepthFt: 0, manningNDelta: 0 },
    requiresHumanSignoff: true,
    provenance: 'simulation',
  },
  {
    id: 'berm-raise-1ft',
    name: 'Raise agricultural berm +1 ft',
    description:
      'Screening-level: uniform +1 ft on berm cells. Does NOT model permits, ' +
      'USACE §408/§404 review, or compensatory storage — those are Stage 6/7 human deliberations.',
    informsStages: ['stage-6-statutory-compliance', 'stage-7-grant-eligibility'],
    paramDeltas: { bermRaiseFt: 1, dredgeDepthFt: 0, manningNDelta: 0 },
    requiresHumanSignoff: true,
    provenance: 'simulation',
  },
  {
    id: 'berm-raise-2ft',
    name: 'Raise agricultural berm +2 ft',
    description:
      'Screening-level: uniform +2 ft on berm cells. Same regulatory caveats as +1 ft; ' +
      'a taller berm changes backwater behavior — re-run the full scenario before comparing.',
    informsStages: ['stage-6-statutory-compliance', 'stage-7-grant-eligibility'],
    paramDeltas: { bermRaiseFt: 2, dredgeDepthFt: 0, manningNDelta: 0 },
    requiresHumanSignoff: true,
    provenance: 'simulation',
  },
  {
    id: 'channel-dredge-2ft',
    name: 'Dredge drainage channel −2 ft',
    description:
      'Screening-level: uniform −2 ft on channel cells plus roughness reduction ' +
      '(manningN −0.005, representing cleared vegetation). Dredging triggers ' +
      'Stage 6 statutory review (permits) before any real-world consideration.',
    informsStages: ['stage-6-statutory-compliance', 'stage-7-grant-eligibility'],
    paramDeltas: { bermRaiseFt: 0, dredgeDepthFt: 2, manningNDelta: -0.005 },
    requiresHumanSignoff: true,
    provenance: 'simulation',
  },
];

export function getAlternative(id: AlternativeId): AlternativeSpec {
  const found = MITIGATION_ALTERNATIVES.find((a) => a.id === id);
  if (!found) {
    throw new Error(`[flood-sim-workbench] unknown alternative ${JSON.stringify(id)}`);
  }
  return found;
}

/**
 * Apply an alternative's parameter deltas to an elevation grid + manningN.
 * MUST only be called after explicit human sign-off in the UI — this
 * function is the mechanism, the sign-off gate lives in the component.
 * `isBermCell` / `isChannelCell` classify cells (row, col) => boolean.
 */
export function applyAlternativeToTerrain(opts: {
  elevationFt: number[][];
  manningN: number;
  alternative: AlternativeSpec;
  isBermCell: (row: number, col: number) => boolean;
  isChannelCell: (row: number, col: number) => boolean;
  humanSignedOff: boolean;
}): { elevationFt: number[][]; manningN: number } {
  if (!opts.humanSignedOff) {
    throw new Error(
      '[flood-sim-workbench] applyAlternativeToTerrain requires explicit human sign-off (humanSignedOff: true). ' +
        'Simulation outputs inform; they do not auto-apply.',
    );
  }
  const { bermRaiseFt, dredgeDepthFt, manningNDelta } = opts.alternative.paramDeltas;
  const elevationFt = opts.elevationFt.map((row, j) =>
    row.map((e, i) => {
      let v = e;
      if (opts.isBermCell(j, i)) v += bermRaiseFt;
      if (opts.isChannelCell(j, i)) v -= dredgeDepthFt;
      return v;
    }),
  );
  const manningN = opts.manningN + manningNDelta;
  if (!(manningN > 0)) {
    throw new Error('[flood-sim-workbench] alternative would make manningN non-positive — rejected');
  }
  return { elevationFt, manningN };
}

// ---------------------------------------------------------------------------
// Cross-section profiler
// ---------------------------------------------------------------------------

export interface CrossSectionPoint {
  distanceFt: number;
  groundElevFt: number;
  depthFt: number;
  /** Water-surface elevation = ground + depth, ft. */
  wseFt: number;
  provenance: 'simulation';
}

/**
 * Sample a cross-section along a straight transect over the depth grid.
 * `from`/`to` are fractional grid coordinates {col, row}; `samples` points
 * are bilinearly interpolated. Pure function of engine state.
 */
export function crossSectionProfile(opts: {
  elevationFt: number[][];
  depthFt: number[][];
  dxFt: number;
  from: { col: number; row: number };
  to: { col: number; row: number };
  samples?: number;
}): CrossSectionPoint[] {
  const ny = opts.elevationFt.length;
  const nx = opts.elevationFt[0]?.length ?? 0;
  if (ny === 0 || nx === 0) throw new Error('[flood-sim-workbench] empty grids');
  const samples = opts.samples ?? 64;
  if (!Number.isInteger(samples) || samples < 2) {
    throw new Error('[flood-sim-workbench] samples must be an integer >= 2');
  }
  const sampleGrid = (grid: number[][], col: number, row: number): number => {
    const c = Math.min(nx - 1.001, Math.max(0, col));
    const r = Math.min(ny - 1.001, Math.max(0, row));
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const fc = c - c0;
    const fr = r - r0;
    const a = grid[r0][c0];
    const b = grid[r0][c0 + 1];
    const cc = grid[r0 + 1][c0];
    const d = grid[r0 + 1][c0 + 1];
    return a + (b - a) * fc + (cc - a) * fr + (a - b - cc + d) * fc * fr;
  };
  const points: CrossSectionPoint[] = [];
  const totalCol = opts.to.col - opts.from.col;
  const totalRow = opts.to.row - opts.from.row;
  const totalCells = Math.hypot(totalCol, totalRow);
  for (let k = 0; k < samples; k += 1) {
    const f = k / (samples - 1);
    const col = opts.from.col + totalCol * f;
    const row = opts.from.row + totalRow * f;
    const ground = sampleGrid(opts.elevationFt, col, row);
    const depth = Math.max(0, sampleGrid(opts.depthFt, col, row));
    points.push({
      distanceFt: f * totalCells * opts.dxFt,
      groundElevFt: ground,
      depthFt: depth,
      wseFt: ground + depth,
      provenance: 'simulation',
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Cut/fill readout
// ---------------------------------------------------------------------------

export interface CutFillResult {
  cutFt3: number;
  fillFt3: number;
  netFt3: number;
  cellAreaFt2: number;
  provenance: 'simulation';
  note: string;
}

/**
 * Cut/fill volumes between two terrain states over the same grid.
 * before/after are elevation grids (ft); dxFt is cell size. Positive net =
 * net fill added. Readout only — no terrain is modified here.
 */
export function cutFillVolumes(
  beforeElevFt: number[][],
  afterElevFt: number[][],
  dxFt: number,
): CutFillResult {
  if (!Number.isFinite(dxFt) || dxFt <= 0) {
    throw new Error('[flood-sim-workbench] dxFt must be finite and > 0');
  }
  const ny = beforeElevFt.length;
  const nx = beforeElevFt[0]?.length ?? 0;
  if (afterElevFt.length !== ny || (afterElevFt[0]?.length ?? -1) !== nx) {
    throw new Error('[flood-sim-workbench] before/after grids must share dimensions');
  }
  const cellArea = dxFt * dxFt;
  let cut = 0;
  let fill = 0;
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const delta = afterElevFt[j][i] - beforeElevFt[j][i];
      if (!Number.isFinite(delta)) {
        throw new Error(`[flood-sim-workbench] non-finite delta at [${j}][${i}]`);
      }
      if (delta > 0) fill += delta * cellArea;
      else cut += -delta * cellArea;
    }
  }
  return {
    cutFt3: cut,
    fillFt3: fill,
    netFt3: fill - cut,
    cellAreaFt2: cellArea,
    provenance: 'simulation',
    note: 'Readout only. Volumes are screening-level estimates from grid differences — not surveyed quantities.',
  };
}

// ---------------------------------------------------------------------------
// Datum gate
// ---------------------------------------------------------------------------

export type GaugeStatus = 'LIVE' | 'STALE' | 'SOURCE_UNAVAILABLE';

/**
 * Datum-gated water-surface elevation. Returns a NAVD88 WSE only when a
 * VALIDATED gage zero is supplied; otherwise returns the literal
 * "SOURCE DATUM ONLY" — never an interpolated or assumed NAVD88 value.
 * Missing gauge data is never interpolated: status is explicit.
 */
export function wseFromGageHeight(opts: {
  gageHeightFt: number | null;
  gageZeroNavd88Ft: number | null;
  gageZeroValidated: boolean;
  status: GaugeStatus;
  asOfIso: string;
}): { wseNavd88Ft: number; status: GaugeStatus; asOfIso: string } | { wse: 'SOURCE DATUM ONLY'; status: GaugeStatus; asOfIso: string; reason: string } {
  const { gageHeightFt, gageZeroNavd88Ft, gageZeroValidated, status, asOfIso } = opts;
  if (status !== 'LIVE' || gageHeightFt === null || !Number.isFinite(gageHeightFt)) {
    return {
      wse: 'SOURCE DATUM ONLY',
      status,
      asOfIso,
      reason: 'Gauge data not live — no WSE computed. Missing data is never interpolated.',
    };
  }
  if (!gageZeroValidated || gageZeroNavd88Ft === null || !Number.isFinite(gageZeroNavd88Ft)) {
    return {
      wse: 'SOURCE DATUM ONLY',
      status,
      asOfIso,
      reason: 'No validated NAVD88 gage zero on file — WSE_NAVD88 = gage_height + gage_zero_validated only.',
    };
  }
  return { wseNavd88Ft: gageHeightFt + gageZeroNavd88Ft, status, asOfIso };
}
