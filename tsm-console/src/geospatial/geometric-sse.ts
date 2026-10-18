/**
 * Screen-space error from 3D Tiles geometricError (meters).
 * Cesium-aligned:
 *   SSE = (geometricError * viewportHeightPx) / (distanceM * sseDenominator)
 * sseDenominator ≈ 2 * tan(fovY/2)
 */

export interface GeometricSseParams {
  geometricErrorM: number;
  distanceM: number;
  viewportHeightPx: number;
  fovYRadians?: number;
  sseDenominator?: number;
  epsilonM?: number;
}

export function perspectiveSseDenominator(fovYRadians: number): number {
  if (!Number.isFinite(fovYRadians) || fovYRadians <= 0 || fovYRadians >= Math.PI) {
    throw new RangeError('fovYRadians must be in (0, π)');
  }
  return 2 * Math.tan(fovYRadians / 2);
}

export function computeGeometricSse(p: GeometricSseParams): number {
  const {
    geometricErrorM,
    distanceM,
    viewportHeightPx,
    fovYRadians,
    sseDenominator: denomIn,
    epsilonM = 1e-7,
  } = p;

  if (![geometricErrorM, distanceM, viewportHeightPx].every(Number.isFinite)) {
    throw new RangeError('geometricErrorM, distanceM, viewportHeightPx must be finite');
  }
  if (geometricErrorM < 0 || viewportHeightPx <= 0) {
    throw new RangeError('geometricErrorM >= 0 and viewportHeightPx > 0 required');
  }

  const denom =
    denomIn ??
    (fovYRadians !== undefined ? perspectiveSseDenominator(fovYRadians) : undefined);
  if (denom === undefined || !Number.isFinite(denom) || denom <= 0) {
    throw new RangeError('Provide sseDenominator or fovYRadians');
  }

  const d = Math.max(distanceM, epsilonM);
  return (geometricErrorM * viewportHeightPx) / (d * denom);
}

export function shouldRefineTile(ssePx: number, maximumScreenSpaceErrorPx: number): boolean {
  if (![ssePx, maximumScreenSpaceErrorPx].every(Number.isFinite)) return false;
  return ssePx > maximumScreenSpaceErrorPx;
}
