/**
 * WebGPU camera bridge — explicit MapLibre / engineering-frame transform.
 * MapLibre Web Mercator is never silently treated as metres.
 * Presentation-only: does not write evidence, models, or regulatory state.
 */

export interface MetricLocalOrigin {
  readonly lonDeg: number;
  readonly latDeg: number;
  readonly verticalDatum: string;
  readonly horizontalCrs: string;
}

export interface MapLibreCameraSnapshot {
  readonly centerLngLat: readonly [number, number];
  readonly altitudeMeters: number;
  readonly bearingDeg: number;
  readonly pitchDeg: number;
  readonly fovDeg: number;
  readonly viewport: readonly [number, number];
  readonly nearMeters: number;
  readonly farMeters: number;
}

export interface BridgedCameraMatrices {
  readonly inverseViewProjection: Float32Array;
  readonly cameraPositionMeters: readonly [number, number, number];
  readonly transformProvenance: {
    readonly horizontalCrs: string;
    readonly verticalDatum: string;
    readonly originLonDeg: number;
    readonly originLatDeg: number;
    readonly units: 'metres';
    readonly note: string;
  };
}

const DEG2RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLon(latDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos(latDeg * DEG2RAD);
}

function multiply4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function invert4(m: Float32Array): Float32Array | null {
  const inv = new Float32Array(16);
  inv[0] = m[5]*m[10]*m[15]-m[5]*m[11]*m[14]-m[9]*m[6]*m[15]+m[9]*m[7]*m[14]+m[13]*m[6]*m[11]-m[13]*m[7]*m[10];
  inv[4] = -m[4]*m[10]*m[15]+m[4]*m[11]*m[14]+m[8]*m[6]*m[15]-m[8]*m[7]*m[14]-m[12]*m[6]*m[11]+m[12]*m[7]*m[10];
  inv[8] = m[4]*m[9]*m[15]-m[4]*m[11]*m[13]-m[8]*m[5]*m[15]+m[8]*m[7]*m[13]+m[12]*m[5]*m[11]-m[12]*m[7]*m[9];
  inv[12] = -m[4]*m[9]*m[14]+m[4]*m[10]*m[13]+m[8]*m[5]*m[14]-m[8]*m[6]*m[13]-m[12]*m[5]*m[10]+m[12]*m[6]*m[9];
  inv[1] = -m[1]*m[10]*m[15]+m[1]*m[11]*m[14]+m[9]*m[2]*m[15]-m[9]*m[3]*m[14]-m[13]*m[2]*m[11]+m[13]*m[3]*m[10];
  inv[5] = m[0]*m[10]*m[15]-m[0]*m[11]*m[14]-m[8]*m[2]*m[15]+m[8]*m[3]*m[14]+m[12]*m[2]*m[11]-m[12]*m[3]*m[10];
  inv[9] = -m[0]*m[9]*m[15]+m[0]*m[11]*m[13]+m[8]*m[1]*m[15]-m[8]*m[3]*m[13]-m[12]*m[1]*m[11]+m[12]*m[3]*m[9];
  inv[13] = m[0]*m[9]*m[14]-m[0]*m[10]*m[13]-m[8]*m[1]*m[14]+m[8]*m[2]*m[13]+m[12]*m[1]*m[10]-m[12]*m[2]*m[9];
  inv[2] = m[1]*m[6]*m[15]-m[1]*m[7]*m[14]-m[5]*m[2]*m[15]+m[5]*m[3]*m[14]+m[13]*m[2]*m[7]-m[13]*m[3]*m[6];
  inv[6] = -m[0]*m[6]*m[15]+m[0]*m[7]*m[14]+m[4]*m[2]*m[15]-m[4]*m[3]*m[14]-m[12]*m[2]*m[7]+m[12]*m[3]*m[6];
  inv[10] = m[0]*m[5]*m[15]-m[0]*m[7]*m[13]-m[4]*m[1]*m[15]+m[4]*m[3]*m[13]+m[12]*m[1]*m[7]-m[12]*m[3]*m[5];
  inv[14] = -m[0]*m[5]*m[14]+m[0]*m[6]*m[13]+m[4]*m[1]*m[14]-m[4]*m[2]*m[13]-m[12]*m[1]*m[6]+m[12]*m[2]*m[5];
  inv[3] = -m[1]*m[6]*m[11]+m[1]*m[7]*m[10]+m[5]*m[2]*m[11]-m[5]*m[3]*m[10]-m[9]*m[2]*m[7]+m[9]*m[3]*m[6];
  inv[7] = m[0]*m[6]*m[11]-m[0]*m[7]*m[10]-m[4]*m[2]*m[11]+m[4]*m[3]*m[10]+m[8]*m[2]*m[7]-m[8]*m[3]*m[6];
  inv[11] = -m[0]*m[5]*m[11]+m[0]*m[7]*m[9]+m[4]*m[1]*m[11]-m[4]*m[3]*m[9]-m[8]*m[1]*m[7]+m[8]*m[3]*m[5];
  inv[15] = m[0]*m[5]*m[10]-m[0]*m[6]*m[9]-m[4]*m[1]*m[10]+m[4]*m[2]*m[9]+m[8]*m[1]*m[6]-m[8]*m[2]*m[5];
  const det = m[0]*inv[0]+m[1]*inv[4]+m[2]*inv[8]+m[3]*inv[12];
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  for (let i = 0; i < 16; i++) inv[i] *= invDet;
  return inv;
}

export function lngLatToLocalMeters(
  lonDeg: number,
  latDeg: number,
  origin: MetricLocalOrigin,
): readonly [number, number] {
  const east = (lonDeg - origin.lonDeg) * metersPerDegLon(origin.latDeg);
  const north = (latDeg - origin.latDeg) * METERS_PER_DEG_LAT;
  return [east, north];
}

export function bridgeMapLibreCameraToWebGpu(
  camera: MapLibreCameraSnapshot,
  origin: MetricLocalOrigin,
): BridgedCameraMatrices {
  if (!Number.isFinite(camera.altitudeMeters) || camera.altitudeMeters < 0) {
    throw new Error('altitudeMeters must be a finite non-negative explicit host value.');
  }
  if (camera.viewport[0] <= 0 || camera.viewport[1] <= 0) {
    throw new Error('viewport dimensions must be positive.');
  }
  if (camera.nearMeters <= 0 || camera.farMeters <= camera.nearMeters) {
    throw new Error('near/far clip distances must be valid metric values.');
  }

  const [camE, camN] = lngLatToLocalMeters(camera.centerLngLat[0], camera.centerLngLat[1], origin);
  const cameraPositionMeters: readonly [number, number, number] = [camE, camera.altitudeMeters, camN];

  const pitch = camera.pitchDeg * DEG2RAD;
  const bearing = camera.bearingDeg * DEG2RAD;
  const lookX = Math.sin(bearing) * Math.cos(pitch);
  const lookY = -Math.sin(pitch);
  const lookZ = Math.cos(bearing) * Math.cos(pitch);
  const target: [number, number, number] = [
    cameraPositionMeters[0] + lookX,
    cameraPositionMeters[1] + lookY,
    cameraPositionMeters[2] + lookZ,
  ];

  const view = lookAt(cameraPositionMeters, target, [0, 1, 0]);
  const aspect = camera.viewport[0] / camera.viewport[1];
  const proj = perspective(camera.fovDeg * DEG2RAD, aspect, camera.nearMeters, camera.farMeters);
  const inverseViewProjection = invert4(multiply4(proj, view));
  if (!inverseViewProjection) {
    throw new Error('Failed to invert view-projection matrix; check camera parameters.');
  }

  return {
    inverseViewProjection,
    cameraPositionMeters,
    transformProvenance: {
      horizontalCrs: origin.horizontalCrs,
      verticalDatum: origin.verticalDatum,
      originLonDeg: origin.lonDeg,
      originLatDeg: origin.latDeg,
      units: 'metres',
      note:
        'Explicit ENU-style bridge from WGS84 degrees to local metres; not silent Web Mercator. ' +
        'For engineering CRS (e.g. EPSG:2966) supply pre-projected metric coordinates instead.',
    },
  };
}

function lookAt(
  eye: readonly [number, number, number],
  target: readonly [number, number, number],
  up: readonly [number, number, number],
): Float32Array {
  const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  const zLen = Math.hypot(zx, zy, zz) || 1;
  const zxN = zx / zLen, zyN = zy / zLen, zzN = zz / zLen;
  let xx = up[1] * zzN - up[2] * zyN, xy = up[2] * zxN - up[0] * zzN, xz = up[0] * zyN - up[1] * zxN;
  const xLen = Math.hypot(xx, xy, xz) || 1;
  xx /= xLen; xy /= xLen; xz /= xLen;
  const yx = zyN * xz - zzN * xy, yy = zzN * xx - zxN * xz, yz = zxN * xy - zyN * xx;
  const out = new Float32Array(16);
  out[0] = xx; out[1] = yx; out[2] = zxN; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zyN; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zzN; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zxN * eye[0] + zyN * eye[1] + zzN * eye[2]);
  out[15] = 1;
  return out;
}

function perspective(fovy: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovy / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f;
  out[10] = (far + near) / (near - far); out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}
