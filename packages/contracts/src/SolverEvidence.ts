/**
 * Immutable evidence contract for environmental and civil-engineering solver runs.
 *
 * VERIFIED describes the solver's reported execution result only. Scientific
 * release still requires independent evidence validation and human review.
 */
export type SolverName = 'HEC-RAS' | 'MODFLOW-6' | 'SLOPE-STABILITY' | 'SWMM';

export type SolverStatus =
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'NON_CONVERGENT'
  | 'DATA_ERROR'
  | 'UNIT_MISMATCH'
  | 'DATUM_MISMATCH'
  | 'NOT_EVALUATED'
  | 'GATE_BLOCKED_BY_SOLVER_ERROR'
  | 'VERIFIED';

export interface SolverExecutionMetrics {
  readonly durationMs: number;
  readonly iterations?: number;
  readonly massBalanceErrorPct?: number;
  readonly maxFactorOfSafety?: number;
}

export interface SolverSpatialMetadata {
  /** Coordinate reference system identifier, e.g. EPSG:2966. */
  readonly crs: string;
  /** Vertical datum identifier, e.g. NAVD88; must be explicit. */
  readonly verticalDatum: string;
  /** Declared canonical output quantity unit, e.g. ft or cfs. */
  readonly unit: string;
}

export interface SolverEvidence {
  readonly runId: string;
  readonly solverName: SolverName;
  readonly solverVersion: string;
  readonly timestamp: string;
  readonly inputManifestHash: string;
  readonly configHash: string;
  readonly outputArtifactHashes: Readonly<Record<string, string>>;
  readonly status: SolverStatus;
  readonly executionMetrics: SolverExecutionMetrics;
  readonly spatialMetadata: SolverSpatialMetadata;
  readonly evidenceBundleHash: string;
}

export type UnsealedSolverEvidence = Omit<SolverEvidence, 'evidenceBundleHash'>;
