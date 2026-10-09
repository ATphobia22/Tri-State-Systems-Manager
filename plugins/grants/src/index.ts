/**
 * Grants plugin — tracking helpers only. Never auto-submits applications.
 */

export interface GrantTrackRecord {
  readonly programId: string;
  readonly name: string;
  readonly deadlineAt?: string;
  readonly floodWaterRelevant: boolean;
  readonly humanActionRequired: true;
  readonly autoSubmit: false;
}

export function trackGrant(input: {
  programId: string;
  name: string;
  deadlineAt?: string;
  floodWaterRelevant?: boolean;
}): GrantTrackRecord {
  return {
    programId: input.programId,
    name: input.name,
    deadlineAt: input.deadlineAt,
    floodWaterRelevant: input.floodWaterRelevant === true,
    humanActionRequired: true,
    autoSubmit: false,
  };
}

export const CRITICAL_NEAR_TERM = [
  { programId: 'JAG', note: 'Confirm current ICJI deadline before filing' },
  { programId: 'LEPP', note: 'Confirm current deadline before filing' },
  { programId: 'EMPG', note: 'Confirm current deadline before filing' },
  { programId: 'HMEP', note: 'Confirm current deadline before filing' },
] as const;
