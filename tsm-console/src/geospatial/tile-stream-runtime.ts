/**
 * Operational bridge: apply decideTileStream budgets to 3d-tiles-renderer.
 * Resilient: never fabricates tiles; only adjusts SSE / error targets and telemetry.
 */

import {
  decideTileStream,
  type TileStreamBudget,
  type TileStreamDecision,
  type TileStreamSample,
} from './tile-stream-controller';
import { StateWordDecoder, STATE_WORD_DEFAULT } from './state-word';

export interface TilesRendererStreamHooks {
  /** nasa-ammos/3d-tiles-renderer style error target in pixels */
  errorTarget?: number;
  errorThreshold?: number;
}

export interface StreamRuntimeTelemetry {
  lastSsePx: number;
  phase: TileStreamDecision['phase'];
  stateWord: number;
  shouldRefine: boolean;
  decisions: number;
}

const DEFAULT_BUDGET: TileStreamBudget = {
  viewportHeightPx: 900,
  fovYRadians: (60 * Math.PI) / 180,
  maximumScreenSpaceErrorPx: 16,
  vramUsageRatio: 0.5,
  bandwidthMbps: 50,
};

export function estimateDistanceFromZoom(zoom: number): number {
  const z = Math.min(24, Math.max(0, zoom));
  return (40075016.686 / 2 ** z) * 2.5;
}

export function applyStreamBudgetToTilesRenderer(
  tiles: TilesRendererStreamHooks,
  opts: {
    zoom: number;
    geometricErrorM?: number;
    inFrustum?: boolean;
    viewportHeightPx?: number;
    vramUsageRatio?: number;
    bandwidthMbps?: number;
    phase?: TileStreamSample['phase'];
    stateWord?: number;
  },
): StreamRuntimeTelemetry {
  const distanceM = estimateDistanceFromZoom(opts.zoom);
  const sample: TileStreamSample = {
    tileId: 'root',
    geometricErrorM: opts.geometricErrorM ?? Math.max(16, distanceM * 0.02),
    distanceM,
    inFrustum: opts.inFrustum ?? true,
    phase: opts.phase ?? 'DORMANT',
    stateWord: opts.stateWord ?? StateWordDecoder.encode(STATE_WORD_DEFAULT),
  };
  const budget: TileStreamBudget = {
    ...DEFAULT_BUDGET,
    viewportHeightPx: opts.viewportHeightPx ?? DEFAULT_BUDGET.viewportHeightPx,
    vramUsageRatio: opts.vramUsageRatio ?? DEFAULT_BUDGET.vramUsageRatio,
    bandwidthMbps: opts.bandwidthMbps ?? DEFAULT_BUDGET.bandwidthMbps,
  };
  const decision = decideTileStream(sample, budget);

  // Map SSE policy onto renderer errorTarget (pixels).
  // Tighter when ACTIVE + refine; looser when DORMANT/UNLOADED.
  let errorTarget = budget.maximumScreenSpaceErrorPx;
  if (decision.phase === 'ACTIVE' && decision.shouldRefine) {
    errorTarget = Math.max(4, budget.maximumScreenSpaceErrorPx * 0.75);
  } else if (decision.phase === 'DORMANT') {
    errorTarget = budget.maximumScreenSpaceErrorPx * 1.5;
  } else if (decision.phase === 'UNLOADED') {
    errorTarget = budget.maximumScreenSpaceErrorPx * 4;
  }
  tiles.errorTarget = errorTarget;
  if (typeof tiles.errorThreshold === 'number') {
    tiles.errorThreshold = errorTarget * 1.25;
  }

  return {
    lastSsePx: decision.ssePx,
    phase: decision.phase,
    stateWord: decision.stateWord,
    shouldRefine: decision.shouldRefine,
    decisions: 1,
  };
}
