import type { EvidenceValidationResult, SystemEvidencePayload } from '../../evidence/src/index.ts';
import { validateSystemEvidence } from '../../evidence/src/index.ts';

export type EngineeringGateState =
  | 'INPUT_INCOMPLETE'
  | 'EVIDENCE_REQUIRED'
  | 'PROVENANCE_INVALID'
  | 'GAGE_CONVERSION_UNPUBLISHED'
  | 'HUMAN_AUTHORITY_REQUIRED'
  | 'ENGINEERING_REVIEW_REQUIRED'
  | 'READY_FOR_DETERMINISTIC_COMPUTATION';

export interface EngineeringGateResult {
  readonly state: EngineeringGateState;
  readonly validation: EvidenceValidationResult;
  /** Computational solvers may run only when true AND human still approves outputs. */
  readonly canCompute: boolean;
  /** Never true in automated path — regulatory approval is always human. */
  readonly canApprove: false;
}

export interface GageConversionInput {
  readonly siteNo: string;
  readonly gageHeightFt: number;
  readonly gageZeroNavd88Ft: number | null;
  readonly conversionPublished: boolean;
}

export interface GageConversionResult {
  readonly ok: boolean;
  readonly wseNavd88Ft: number | null;
  readonly reason: string;
}

/** Fail-closed NAVD88 conversion: never report success unless a published, valid conversion is applied. */
export function convertGageHeightToNavd88(input: GageConversionInput): GageConversionResult {
  if (!input.conversionPublished) {
    return {
      ok: false,
      wseNavd88Ft: null,
      reason: 'GAGE_CONVERSION_UNPUBLISHED: stage remains source-datum-only; NAVD88 conversion unavailable',
    };
  }
  if (input.gageZeroNavd88Ft == null || !Number.isFinite(input.gageZeroNavd88Ft)) {
    return {
      ok: false,
      wseNavd88Ft: null,
      reason: 'GAGE_DATUM_UNAVAILABLE: gage_zero_navd88_ft is null; NAVD88 WSE unavailable',
    };
  }
  if (input.gageHeightFt === -999 || !Number.isFinite(input.gageHeightFt)) {
    return {
      ok: false,
      wseNavd88Ft: null,
      reason: 'GAGE_HEIGHT_INVALID: sentinel or non-finite stage; no WSE computed',
    };
  }
  return {
    ok: true,
    wseNavd88Ft: input.gageHeightFt + input.gageZeroNavd88Ft,
    reason: 'ok',
  };
}

export interface LomaLagBfeInput {
  readonly lagFtNavd88: number;
  readonly bfeFtNavd88: number;
}

/** LOMA natural-grade test helper: LAG >= BFE. Does not file or approve. */
export function evaluateLomaLagVsBfe(input: LomaLagBfeInput): {
  readonly passes: boolean;
  readonly freeboardFt: number;
  readonly autoFile: false;
} {
  const freeboardFt = input.lagFtNavd88 - input.bfeFtNavd88;
  return {
    passes: input.lagFtNavd88 >= input.bfeFtNavd88,
    freeboardFt,
    autoFile: false,
  };
}

export interface HumanAuthoritySeal {
  readonly humanAuthorized: boolean;
  readonly reviewerIdentity: string;
  readonly reviewReason: string;
  readonly reviewedAt: string;
}

export function requireHumanAuthoritySeal(seal: Partial<HumanAuthoritySeal> | null | undefined): {
  readonly ok: boolean;
  readonly reason: string;
} {
  if (!seal?.humanAuthorized) {
    return { ok: false, reason: 'HUMAN_AUTHORITY_REQUIRED: explicit human authorization is missing' };
  }
  if (!seal.reviewerIdentity?.trim() || !seal.reviewReason?.trim() || !seal.reviewedAt?.trim()) {
    return {
      ok: false,
      reason: 'HUMAN_AUTHORITY_SEAL_INCOMPLETE: reviewer identity, review reason, and reviewed timestamp are required',
    };
  }
  return { ok: true, reason: 'ok' };
}

export function evaluateEngineeringGate(payload: Partial<SystemEvidencePayload>): EngineeringGateResult {
  const validation = validateSystemEvidence(payload);
  if (validation.issues.some((i) => i.code === 'INPUT_INCOMPLETE')) {
    return { state: 'INPUT_INCOMPLETE', validation, canCompute: false, canApprove: false };
  }
  if (validation.issues.some((i) => i.code === 'EVIDENCE_REQUIRED')) {
    return { state: 'EVIDENCE_REQUIRED', validation, canCompute: false, canApprove: false };
  }
  if (
    validation.issues.some(
      (i) =>
        i.code === 'PROVENANCE_REQUIRED' ||
        i.code === 'SYNTHETIC_DATA_REJECTED' ||
        i.code === 'CONTRADICTORY_DATA',
    )
  ) {
    return { state: 'PROVENANCE_INVALID', validation, canCompute: false, canApprove: false };
  }
  // Valid evidence still requires human engineering review before any regulatory use.
  return {
    state: 'ENGINEERING_REVIEW_REQUIRED',
    validation,
    canCompute: false,
    canApprove: false,
  };
}
