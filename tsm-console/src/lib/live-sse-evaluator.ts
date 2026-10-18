/**
 * TSM Live SSE Evaluator (P1.1)
 *
 * Calculates live Screen Space Error dynamically for 3D Tiles HLOD
 * tile refinement and streaming selection.
 *
 * Formula: SSE = (d * h) / (2 * r * tan(θ/2))
 * Where:
 *   d = geometric error of tile (meters)
 *   h = viewport height (pixels)
 *   r = distance from camera to tile center (meters)
 *   θ = vertical field of view (radians)
 */

export interface CameraMetrics {
  position: [number, number, number];
  viewportHeight: number;
  verticalFovRadians: number;
}

export class LiveSSEEvaluator {
  /**
   * Calculates the projected Screen Space Error in pixels for a tile.
   */
  public static computeSSE(
    geometricError: number,
    boundingCenter: [number, number, number],
    camera: CameraMetrics
  ): number {
    const dx = boundingCenter[0] - camera.position[0];
    const dy = boundingCenter[1] - camera.position[1];
    const dz = boundingCenter[2] - camera.position[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance <= 0.0001) return Number.MAX_VALUE;

    const denominator = 2.0 * distance * Math.tan(camera.verticalFovRadians / 2.0);
    const sse = (geometricError * camera.viewportHeight) / denominator;

    return sse;
  }

  /**
   * Determines whether a tile should refine into child octree nodes.
   * Default threshold: 16px (per 3D Tiles 1.1 spec guidance).
   */
  public static shouldRefine(
    geometricError: number,
    boundingCenter: [number, number, number],
    camera: CameraMetrics,
    targetPixelThreshold: number = 16.0
  ): boolean {
    const currentSSE = LiveSSEEvaluator.computeSSE(geometricError, boundingCenter, camera);
    return currentSSE >= targetPixelThreshold;
  }

  /**
   * Batch evaluate multiple tiles, returning those needing refinement.
   */
  public static evaluateTiles(
    tiles: Array<{ geometricError: number; boundingCenter: [number, number, number]; id: string }>,
    camera: CameraMetrics,
    threshold: number = 16.0
  ): Array<{ id: string; sse: number }> {
    const needsRefinement: Array<{ id: string; sse: number }> = [];
    for (const tile of tiles) {
      const sse = LiveSSEEvaluator.computeSSE(tile.geometricError, tile.boundingCenter, camera);
      if (sse >= threshold) {
        needsRefinement.push({ id: tile.id, sse });
      }
    }
    // Sort by SSE descending (highest priority first)
    needsRefinement.sort((a, b) => b.sse - a.sse);
    return needsRefinement;
  }
}
