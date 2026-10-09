/**
 * ADR-006 Agentic Autonomy Ladder
 * S1 default — suggest / read-only
 * S2 human-gated — tool allow-list after explicit human confirmation
 * S3 future — not enabled in production
 */

export type AutonomyLevel = 'S1' | 'S2' | 'S3';

export const DEFAULT_AUTONOMY: AutonomyLevel = 'S1';

/** Capabilities that may run at S1 without a human gate (read / describe only). */
const S1_ALLOW = new Set<string>([
  'describe',
  'read',
  'search.local',
  'evidence.validate',
  'gates.evaluate',
  'hydrology.convert_gage', // conversion still fail-closed inside gates
]);

export interface AutonomyDecision {
  readonly allowed: boolean;
  readonly level: AutonomyLevel;
  readonly reason: string;
}

export function evaluateAutonomy(
  capabilityId: string,
  requested: AutonomyLevel = DEFAULT_AUTONOMY,
  humanGated = false,
): AutonomyDecision {
  if (requested === 'S3') {
    return {
      allowed: false,
      level: 'S3',
      reason: 'ADR-006: S3 autonomy is future-only and disabled in production',
    };
  }
  if (requested === 'S1' || requested === DEFAULT_AUTONOMY) {
    const base = capabilityId.split('.')[0] ?? capabilityId;
    const ok =
      S1_ALLOW.has(capabilityId) ||
      S1_ALLOW.has(base) ||
      capabilityId.endsWith('.describe') ||
      capabilityId.endsWith('.read');
    return ok
      ? { allowed: true, level: 'S1', reason: 'S1 read/suggest allow-list' }
      : {
          allowed: false,
          level: 'S1',
          reason: `ADR-006 S1 denial: capability '${capabilityId}' requires S2 human gate`,
        };
  }
  // S2
  if (!humanGated) {
    return {
      allowed: false,
      level: 'S2',
      reason: 'ADR-006 S2 requires explicit human gate confirmation',
    };
  }
  return { allowed: true, level: 'S2', reason: 'S2 human-gated allow' };
}
