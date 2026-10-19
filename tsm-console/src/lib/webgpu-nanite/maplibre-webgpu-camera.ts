/**
 * Shared camera bridge: MapLibre-style view state → matrices for WebGPU plane B.
 *
 * Uses a local ENU frame at the map center (not full ECEF) — sufficient for
 * county-scale occlusion / meshlet culling. Regulatory basemap stays MapLibre.
 */

import { getTilesCameraBasis, getTilesCameraClipPlanes } from '../tiles-3d-camera';

export interface MapLibreCameraState {
  /** Degrees */
  centerLng: number;
  centerLat: number;
  /** MapLibre zoom */
  zoom: number;
  /** Degrees clockwise from north */
  bearing: number;
  /** Degrees; 0 = top-down */
  pitch: number;
  /** Optional altitude of target above ellipsoid (m); default 0 */
  altitudeM?: number;
  /** Viewport size for aspect */
  widthPx: number;
  heightPx: number;
}

export interface WebGpuCameraMatrices {
  /** Column-major 4x4 view matrix */
  view: Float32Array;
  /** Column-major 4x4 perspective projection */
  projection: Float32Array;
  /** Camera position in local ENU meters (E, N, U) */
  eyeENU: [number, number, number];
  targetENU: [number, number, number];
  near: number;
  far: number;
  /** Approximate ground distance from camera to target (m) */
  distanceM: number;
}

/** Rough meters-per-pixel at equator for Web Mercator zoom. */
function metersPerPixel(lat: number, zoom: number): number {
  const earthCirc = 40075016.686;
  return (Math.cos((lat * Math.PI) / 180) * earthCirc) / (256 * 2 ** zoom);
}

function perspective(fovyRad: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovyRad / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function lookAt(
  eye: [number, number, number],
  target: [number, number, number],
  up: [number, number, number],
): Float32Array {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / len;
  const z1 = zy / len;
  const z2 = zz / len;
  let xx = up[1] * z2 - up[2] * z1;
  let xy = up[2] * z0 - up[0] * z2;
  let xz = up[0] * z1 - up[1] * z0;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = z1 * xz - z2 * xy;
  const yy = z2 * xx - z0 * xz;
  const yz = z0 * xy - z1 * xx;
  const out = new Float32Array(16);
  out[0] = xx;
  out[1] = yx;
  out[2] = z0;
  out[4] = xy;
  out[5] = yy;
  out[6] = z1;
  out[8] = xz;
  out[9] = yz;
  out[10] = z2;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

/**
 * Convert MapLibre camera state into WebGPU-ready matrices in a local ENU frame
 * centered on the map target.
 */
export function mapLibreCameraToWebGpu(state: MapLibreCameraState): WebGpuCameraMatrices {
  const {
    centerLat,
    zoom,
    bearing,
    pitch,
    widthPx,
    heightPx,
    altitudeM = 0,
  } = state;

  if (!Number.isFinite(centerLat) || !Number.isFinite(zoom)) {
    throw new RangeError('centerLat and zoom must be finite');
  }
  if (widthPx < 1 || heightPx < 1) throw new RangeError('viewport size must be positive');

  // Approximate camera distance from zoom (viewport height in meters at target)
  const mpp = metersPerPixel(centerLat, zoom);
  const distanceM = Math.max(50, mpp * heightPx * 0.5 / Math.max(0.1, Math.cos((pitch * Math.PI) / 180)));

  const pitchRad = Math.min(Math.max((pitch * Math.PI) / 180, 0), Math.PI / 2 - 0.01);
  const bearingRad = (bearing * Math.PI) / 180;
  const basis = getTilesCameraBasis(pitchRad, bearingRad);
  const clips = getTilesCameraClipPlanes(distanceM);

  const targetENU: [number, number, number] = [0, 0, altitudeM];
  const eyeENU: [number, number, number] = [
    basis.horizontalEast * basis.positionHorizontalScale * distanceM,
    basis.horizontalNorth * basis.positionHorizontalScale * distanceM,
    basis.positionUpScale * distanceM + altitudeM,
  ];
  const up: [number, number, number] = [
    basis.horizontalEast * basis.cameraUpHorizontalScale,
    basis.horizontalNorth * basis.cameraUpHorizontalScale,
    basis.cameraUpVerticalScale,
  ];

  const view = lookAt(eyeENU, targetENU, up);
  const aspect = widthPx / heightPx;
  const fovy = (Math.PI / 180) * 45;
  const projection = perspective(fovy, aspect, clips.near, clips.far);

  return {
    view,
    projection,
    eyeENU,
    targetENU,
    near: clips.near,
    far: clips.far,
    distanceM,
  };
}
