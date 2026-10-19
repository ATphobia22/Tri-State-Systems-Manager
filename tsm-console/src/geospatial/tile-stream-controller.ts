/**
 * Open-world tile stream controller (blueprint P1.3 + P1.4).
 * Wires evaluateSpatialPhase + geometric SSE + StateWordDecoder.evaluateDegradation.
 * Does not claim Cesium runtime; pure decision layer for loaders/render loops.
 */

import {
  evaluateSpatialPhase,
  type SpatialEntityPhase,
  type SpatialPhaseThresholds,
  DEFAULT_SPATIAL_PHASE_THRESHOLDS,
} from './spatial-entity-phase';
import {
  computeGeometricSse,
  shouldRefineTile,
  perspectiveSseDenominator,
} from './geometric-sse';
import { StateWordDecoder, STATE_WORD_DEFAULT, type LodState } from './state-word';

export interface TileStreamSample {
  tileId: string;
  geometricErrorM: number;
  distanceM: number;
  inFrustum: boolean;
  phase: SpatialEntityPhase;
  stateWord: number;
}

export interface TileStreamBudget {
  viewportHeightPx: number;
  fovYRadians: number;
  maximumScreenSpaceErrorPx: number;
  vramUsageRatio: number;
  bandwidthMbps: number;
  phaseThresholds?: SpatialPhaseThresholds;
}

export interface TileStreamDecision {
  tileId: string;
  phase: SpatialEntityPhase;
  ssePx: number;
  shouldRefine: boolean;
  stateWord: number;
  lod: LodState;
  loadContent: boolean;
  keepProxyOnly: boolean;
  unload: boolean;
}

export function decideTileStream(
  sample: TileStreamSample,
  budget: TileStreamBudget,
): TileStreamDecision {
  const denom = perspectiveSseDenominator(budget.fovYRadians);
  const ssePx = computeGeometricSse({
    geometricErrorM: sample.geometricErrorM,
    distanceM: sample.distanceM,
    viewportHeightPx: budget.viewportHeightPx,
    sseDenominator: denom,
  });

  const phase = evaluateSpatialPhase(
    {
      phase: sample.phase,
      distanceM: sample.distanceM,
      ssePx,
      inFrustum: sample.inFrustum,
    },
    budget.phaseThresholds ?? DEFAULT_SPATIAL_PHASE_THRESHOLDS,
  );

  let stateWord = sample.stateWord;
  if (phase === 'ACTIVE') {
    stateWord = StateWordDecoder.evaluateDegradation(
      stateWord,
      budget.vramUsageRatio,
      budget.bandwidthMbps,
    );
  } else if (phase === 'DORMANT') {
    // Proxy shell: keep D, strip appearance/components under pressure.
    const lod = StateWordDecoder.decode(stateWord);
    lod.T = Math.min(lod.T, 1);
    lod.C = Math.min(lod.C, 1);
    stateWord = StateWordDecoder.encode(lod);
  } else {
    stateWord = StateWordDecoder.encode({ ...STATE_WORD_DEFAULT, D: 1, C: 0, T: 0, S: 0 });
  }

  const shouldRefine = shouldRefineTile(ssePx, budget.maximumScreenSpaceErrorPx);
  const loadContent = phase === 'ACTIVE';
  const keepProxyOnly = phase === 'DORMANT';
  const unload = phase === 'UNLOADED';

  return {
    tileId: sample.tileId,
    phase,
    ssePx,
    shouldRefine,
    stateWord,
    lod: StateWordDecoder.decode(stateWord),
    loadContent,
    keepProxyOnly,
    unload,
  };
}

export function decideTileStreamBatch(
  samples: TileStreamSample[],
  budget: TileStreamBudget,
): TileStreamDecision[] {
  return samples.map((s) => decideTileStream(s, budget));
}
