/**
 * Hydraulics package rules: simulation outputs are DERIVED / SIMULATION_DEMO
 * unless a human authority seal is attached. Never silently authoritative.
 */

export const SIMULATION_DEMO_LABEL = 'SIMULATION_DEMO' as const;

export interface HydraulicRunSeal {
  readonly modelFamily: 'HEC-RAS' | 'MODFLOW' | 'SWMM' | 'OTHER';
  readonly scenarioLabel: string;
  readonly isSimulationDemo: boolean;
  readonly governorPassed: boolean;
  readonly humanAuthorized: boolean;
  readonly reviewerIdentity?: string;
  readonly reviewReason?: string;
}

export function classifyHydraulicAuthority(seal: HydraulicRunSeal): {
  readonly authoritative: false;
  readonly label: string;
  readonly mayInformHuman: boolean;
  readonly reason: string;
} {
  if (!seal.governorPassed) {
    return {
      authoritative: false,
      label: SIMULATION_DEMO_LABEL,
      mayInformHuman: false,
      reason: 'Governor failed — results must not inform decisions',
    };
  }
  if (!seal.humanAuthorized || !seal.reviewerIdentity?.trim() || !seal.reviewReason?.trim()) {
    return {
      authoritative: false,
      label: SIMULATION_DEMO_LABEL,
      mayInformHuman: true,
      reason: 'Human seal incomplete — display as simulation only',
    };
  }
  return {
    authoritative: false,
    label: 'HUMAN_REVIEWED_SIMULATION',
    mayInformHuman: true,
    reason: 'Human-reviewed simulation still not a regulatory map or LOMA',
  };
}
