import type { SystemEvidencePayload } from '../../evidence/src/index.ts';
import { evaluateEngineeringGate, type EngineeringGateResult } from '../../gates/src/index.ts';

export interface EngineeringEvidencePipelineResult {
  readonly gate: EngineeringGateResult;
  readonly readyForSolver: false;
}

export function evaluateEngineeringEvidence(payload: Partial<SystemEvidencePayload>): EngineeringEvidencePipelineResult {
  const gate = evaluateEngineeringGate(payload);
  return { gate, readyForSolver: false };
}
