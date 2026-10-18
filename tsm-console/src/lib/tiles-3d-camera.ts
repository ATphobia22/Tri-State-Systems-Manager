/**
 * Compute camera clipping planes for the ECEF-based 3D Tiles camera.
 * Distances are meters from the map target; the target must remain inside
 * the far plane as the user zooms out.
 */
export interface CameraClipPlanes {
  near: number;
  far: number;
}

export function getTilesCameraClipPlanes(distanceMeters: number): CameraClipPlanes {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new RangeError('Camera distance must be a positive finite number.');
  }

  return {
    near: Math.max(0.1, distanceMeters / 10_000),
    far: Math.max(10_000, distanceMeters * 4),
  };
}
