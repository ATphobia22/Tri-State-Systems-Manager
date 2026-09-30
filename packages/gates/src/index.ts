import type { EvidenceValidationResult, SystemEvidencePayload } from '../../evidence/src/index.ts';
import { validateSystemEvidence } from '../../evidence/src/index.ts';

export type EngineeringGateState =
  | 'INPUT_INCOMPLETE'
  | 'EVIDENCE_REQUIRED'
  | 'PROVENANCE_INVALID'
  | 'ENGINEERING_REVIEW_REQUIRED'
  | 'READY_FOR_DETERMINISTIC_COMPUTATION';

export interface EngineeringGateResult {
  readonly state: EngineeringGateState;
  readonly validation: EvidenceValidationResult;
  readonly canCompute: boolean;
  readonly canApprove: false;
}

export function evaluateEngineeringGate(payload: Partial<SystemEvidencePayload>): EngineeringGateResult {
  const validation = validateSystemEvidence(payload);
  if (validation.issues.some((i) => i.code === 'INPUT_INCOMPLETE')) {
    return { state: 'INPUT_INCOMPLETE', validation, canCompute: false, canApprove: false };
  }
  if (validation.issues.some((i) => i.code === 'EVIDENCE_REQUIRED')) {
    return { state: 'EVIDENCE_REQUIRED', validation, canCompute: false, canApprove: false };
  }
  if (validation.issues.some((i) => i.code === 'PROVENANCE_REQUIRED' || i.code === 'SYNTHETIC_DATA_REJECTED' || i.code === 'CONTRADICTORY_DATA')) {
    return { state: 'PROVENANCE_INVALID', validation, canCompute: false, canApprove: false };
  }
  return { state: 'ENGINEERING_REVIEW_REQUIRED', validation, canCompute: false, canApprove: false };
}
