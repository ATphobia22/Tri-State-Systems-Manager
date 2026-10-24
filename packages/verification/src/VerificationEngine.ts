import type { ReplayVerification } from '../../contracts/src/ReplayVerification.js';
import type { SolverEvidence } from '../../contracts/src/SolverEvidence.js';
import { EvidenceCollector } from '../../evidence-runtime/src/EvidenceCollector.js';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SOLVER_NAMES = new Set(['HEC-RAS', 'MODFLOW-6', 'SLOPE-STABILITY', 'SWMM']);
const SOLVER_STATUSES = new Set([
  'FAILED', 'TIMEOUT', 'CANCELLED', 'NON_CONVERGENT', 'DATA_ERROR',
  'UNIT_MISMATCH', 'DATUM_MISMATCH', 'NOT_EVALUATED',
  'GATE_BLOCKED_BY_SOLVER_ERROR', 'VERIFIED',
]);

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
    && Number.isFinite(Date.parse(value))
    && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

export class VerificationEngine {
  /** Validate a solver evidence bundle before any downstream release decision. */
  public static validateExecution(evidence: SolverEvidence): ValidationResult {
    const errors: string[] = [];
    if (!evidence || typeof evidence !== 'object') {
      return { valid: false, errors: ['Solver evidence is required.'] };
    }

    if (typeof evidence.runId !== 'string' || !evidence.runId.trim()) errors.push('Missing solver run identifier.');
    if (!SOLVER_NAMES.has(evidence.solverName)) errors.push(`Unsupported solver name: ${String(evidence.solverName)}.`);
    if (typeof evidence.solverVersion !== 'string' || !evidence.solverVersion.trim()) errors.push('Missing solver version.');
    if (!isTimestamp(evidence.timestamp)) errors.push('Timestamp must be a valid ISO-8601 value with an explicit timezone.');
    if (!HASH_PATTERN.test(evidence.inputManifestHash)) errors.push('Input manifest hash must be sha256:<64 lowercase hexadecimal characters>.');
    if (!HASH_PATTERN.test(evidence.configHash)) errors.push('Configuration hash must be sha256:<64 lowercase hexadecimal characters>.');
    if (!SOLVER_STATUSES.has(evidence.status)) errors.push(`Unsupported solver status: ${String(evidence.status)}.`);
    if (evidence.status !== 'VERIFIED') errors.push(`Solver status is not VERIFIED: ${evidence.status}.`);

    const metrics = evidence.executionMetrics;
    if (!metrics || typeof metrics !== 'object') {
      errors.push('Execution metrics are required.');
    } else {
      if (!isFiniteNonNegative(metrics.durationMs)) errors.push('Execution duration must be a finite non-negative number.');
      if (metrics.iterations !== undefined && (!Number.isSafeInteger(metrics.iterations) || metrics.iterations < 0)) errors.push('Iteration count must be a non-negative safe integer.');
      if (metrics.massBalanceErrorPct !== undefined && !isFiniteNonNegative(metrics.massBalanceErrorPct)) errors.push('Mass-balance error must be finite and non-negative.');
      if (metrics.maxFactorOfSafety !== undefined && (!Number.isFinite(metrics.maxFactorOfSafety) || metrics.maxFactorOfSafety <= 0)) errors.push('Factor of safety must be finite and greater than zero.');
    }

    const spatial = evidence.spatialMetadata;
    if (!spatial || typeof spatial !== 'object') {
      errors.push('Spatial metadata is required.');
    } else {
      if (typeof spatial.unit !== 'string' || !spatial.unit.trim()) errors.push('Unit mismatch or missing unit specification in spatial metadata.');
      if (typeof spatial.verticalDatum !== 'string' || !spatial.verticalDatum.trim()) errors.push('Vertical datum is missing; stage and elevation references must be explicit.');
      if (typeof spatial.crs !== 'string' || !/^EPSG:\d+$/.test(spatial.crs.trim())) errors.push(`Invalid or missing Coordinate Reference System (CRS): ${String(spatial.crs)}.`);
    }

    const outputHashes = evidence.outputArtifactHashes;
    if (!outputHashes || typeof outputHashes !== 'object' || Array.isArray(outputHashes) || Object.keys(outputHashes).length === 0) {
      errors.push('At least one output artifact hash is required to verify solver results.');
    } else {
      for (const [artifact, hash] of Object.entries(outputHashes)) {
        if (!artifact.trim() || !HASH_PATTERN.test(hash)) errors.push(`Invalid output artifact hash entry: ${artifact || '<empty name>'}.`);
      }
    }

    if (!HASH_PATTERN.test(evidence.evidenceBundleHash)) {
      errors.push('Evidence bundle hash must be sha256:<64 lowercase hexadecimal characters>.');
    } else if (!EvidenceCollector.verifyEvidenceIntegrity(evidence)) {
      errors.push('Evidence bundle integrity verification failed.');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Replay results are valid only when all stated tolerances and differences pass. */
  public static validateReplay(replay: ReplayVerification): ValidationResult {
    const errors: string[] = [];
    if (!replay || typeof replay !== 'object') return { valid: false, errors: ['Replay verification is required.'] };
    if (!replay.originalRunId?.trim()) errors.push('Original run identifier is required.');
    if (!replay.replayRunId?.trim()) errors.push('Replay run identifier is required.');
    if (replay.originalRunId === replay.replayRunId) errors.push('Replay run must have a distinct run identifier.');
    if (!isTimestamp(replay.timestamp)) errors.push('Replay timestamp must be ISO-8601 with an explicit timezone.');
    const thresholds = replay.toleranceThresholds;
    if (!thresholds || !isFiniteNonNegative(thresholds.maxStageDifferenceFt)) errors.push('Stage difference tolerance must be finite and non-negative.');
    if (!thresholds || !isFiniteNonNegative(thresholds.maxFlowDifferenceCfs)) errors.push('Flow difference tolerance must be finite and non-negative.');
    if (!Array.isArray(replay.differences)) errors.push('Replay differences must be an array.');
    else if (replay.differences.some((difference) => typeof difference !== 'string' || !difference.trim())) errors.push('Replay differences must contain non-empty descriptions.');
    if (replay.equivalent !== true) errors.push('Replay is not marked equivalent.');
    if (Array.isArray(replay.differences) && replay.differences.length > 0) errors.push('Replay contains differences and cannot be considered equivalent.');
    return { valid: errors.length === 0, errors };
  }
}
