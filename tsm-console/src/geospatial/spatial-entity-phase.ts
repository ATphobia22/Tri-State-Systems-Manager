/**
 * Spatial streaming lifecycle for open-world entities.
 * DISTINCT from native/tristate-core hardware FSM (Inactive/Active/High-Z).
 *
 * UNLOADED: indexed remote/disk only
 * DORMANT:  proxy B + state-word in host RAM / BVH
 * ACTIVE:   glTF + VRAM buffers
 */

export type SpatialEntityPhase = 'UNLOADED' | 'DORMANT' | 'ACTIVE';

export const SPATIAL_PHASE_CODE: Record<SpatialEntityPhase, number> = {
  UNLOADED: 0,
  DORMANT: 1,
  ACTIVE: 2,
};

export interface SpatialPhaseThresholds {
  dormantRadiusM: number;
  evictRadiusM: number;
  activeSsePx: number;
  dormantSsePx: number;
}

export const DEFAULT_SPATIAL_PHASE_THRESHOLDS: SpatialPhaseThresholds = {
  dormantRadiusM: 2500,
  evictRadiusM: 8000,
  activeSsePx: 16,
  dormantSsePx: 4,
};

export interface SpatialPhaseInput {
  phase: SpatialEntityPhase;
  distanceM: number;
  ssePx: number;
  inFrustum: boolean;
}

export function evaluateSpatialPhase(
  input: SpatialPhaseInput,
  t: SpatialPhaseThresholds = DEFAULT_SPATIAL_PHASE_THRESHOLDS,
): SpatialEntityPhase {
  const { phase, distanceM, ssePx, inFrustum } = input;
  if (![distanceM, ssePx].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return phase;
  }

  if (phase === 'UNLOADED') {
    if (distanceM < t.dormantRadiusM) return 'DORMANT';
    return 'UNLOADED';
  }

  if (phase === 'DORMANT') {
    if (distanceM >= t.evictRadiusM) return 'UNLOADED';
    if (inFrustum && ssePx >= t.activeSsePx) return 'ACTIVE';
    return 'DORMANT';
  }

  if (!inFrustum || ssePx < t.dormantSsePx) return 'DORMANT';
  if (distanceM >= t.evictRadiusM) return 'UNLOADED';
  return 'ACTIVE';
}

export const HARDWARE_TRISTATE_NAMESPACE =
  'native/tristate-core (Inactive|Active|HighImpedance)';
export const SPATIAL_TRISTATE_NAMESPACE =
  'tsm-console spatial-entity-phase (UNLOADED|DORMANT|ACTIVE)';
