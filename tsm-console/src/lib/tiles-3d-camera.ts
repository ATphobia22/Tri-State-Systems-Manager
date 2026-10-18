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

export interface TilesCameraBasis {
  horizontalEast: number;
  horizontalNorth: number;
  positionUpScale: number;
  positionHorizontalScale: number;
  cameraUpVerticalScale: number;
  cameraUpHorizontalScale: number;
}

/**
 * Return an orthonormal local camera basis. Pitch and bearing are radians.
 * At pitch zero, camera-up follows the bearing-relative map north; at higher
 * pitch it transitions toward local ellipsoid up without becoming parallel
 * to the view direction.
 */
export function getTilesCameraBasis(pitchRadians: number, bearingRadians: number): TilesCameraBasis {
  if (
    !Number.isFinite(pitchRadians) ||
    pitchRadians < 0 ||
    pitchRadians >= Math.PI / 2 ||
    !Number.isFinite(bearingRadians)
  ) {
    throw new RangeError('Pitch must be in [0, pi/2) and bearing must be finite.');
  }

  return {
    horizontalEast: Math.sin(bearingRadians),
    horizontalNorth: Math.cos(bearingRadians),
    positionUpScale: Math.cos(pitchRadians),
    positionHorizontalScale: -Math.sin(pitchRadians),
    cameraUpVerticalScale: Math.sin(pitchRadians),
    cameraUpHorizontalScale: Math.cos(pitchRadians),
  };
}
