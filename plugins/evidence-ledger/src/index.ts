/** Evidence ledger plugin — validation + human seal; no silent governance. */
export { validateSystemEvidence } from '../../../packages/evidence/src/index.ts';
export {
  evaluateEngineeringGate,
  requireHumanAuthoritySeal,
} from '../../../packages/gates/src/index.ts';

export const LEDGER_RULES = {
  humanAuthorityFinal: true,
  autoApprove: false,
  requiresReviewerIdentity: true,
} as const;
