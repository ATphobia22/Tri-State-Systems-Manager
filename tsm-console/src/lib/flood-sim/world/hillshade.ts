/**
 * world/hillshade.ts — analytic hillshade for the flood-sim terrain mesh.
 *
 * Pure function over an elevation grid (no GL context needed), using Horn's
 * (1981) 3×3 finite-difference method — the same algorithm behind standard
 * GIS hillshade rasters. Deterministic: same grid + options ⇒ bit-identical
 * shade values.
 *
 * The shade value modulates the hypsometric vertex tint in buildTerrainMesh:
 * sun-facing slopes brighten, shadowed slopes darken. It is a *visual*
 * layer only — it never feeds the simulation engine or any evidence output.
 */

export interface HillshadeOptions {
  /** Sun azimuth, degrees clockwise from north. Default 315 (NW, GIS convention). */
  azimuthDeg?: number;
  /** Sun altitude above the horizon, degrees. Default 45. */
  altitudeDeg?: number;
  /** Vertical exaggeration applied to the slope term. Default 1 (none). */
  zFactor?: number;
}

const DEFAULTS: Required<HillshadeOptions> = {
  azimuthDeg: 315,
  altitudeDeg: 45,
  zFactor: 1,
};

/**
 * Compute per-cell hillshade in [0, 1] for an elevation grid, row-major
 * Float64Array of length ny*nx. A perfectly flat grid returns a uniform
 * sin(altitude) (no slope ⇒ no directional shading). Edges reuse the nearest
 * valid neighbour (clamped stencil), so every output is finite.
 */
export function computeHillshade(
  elevationFt: number[][],
  dxFt: number,
  opts: HillshadeOptions = {},
): Float64Array {
  const { azimuthDeg, altitudeDeg, zFactor } = { ...DEFAULTS, ...opts };
  const ny = elevationFt.length;
  const nx = elevationFt[0]?.length ?? 0;
  if (ny === 0 || nx === 0) throw new Error('[flood-sim-hillshade] empty elevation grid');
  if (!Number.isFinite(dxFt) || dxFt <= 0) {
    throw new Error('[flood-sim-hillshade] dxFt must be a positive finite number');
  }

  const zenithRad = ((90 - altitudeDeg) * Math.PI) / 180;
  // GIS convention: azimuth measured clockwise from north; math angle below
  // is measured clockwise from north as well via atan2(dx, -dy).
  const azimuthRad = ((360 - azimuthDeg + 90) * Math.PI) / 180;

  const at = (r: number, c: number): number => {
    const rr = Math.min(ny - 1, Math.max(0, r));
    const cc = Math.min(nx - 1, Math.max(0, c));
    return elevationFt[rr][cc];
  };

  const out = new Float64Array(ny * nx);
  for (let r = 0; r < ny; r += 1) {
    for (let c = 0; c < nx; c += 1) {
      // Horn's 3x3 weighted differences (z1..z9, row-major, z5 = centre).
      const dzdx =
        (at(r - 1, c + 1) + 2 * at(r, c + 1) + at(r + 1, c + 1) -
          (at(r - 1, c - 1) + 2 * at(r, c - 1) + at(r + 1, c - 1))) /
        (8 * dxFt);
      const dzdy =
        (at(r + 1, c - 1) + 2 * at(r + 1, c) + at(r + 1, c + 1) -
          (at(r - 1, c - 1) + 2 * at(r - 1, c) + at(r - 1, c + 1))) /
        (8 * dxFt);
      const slopeRad = Math.atan(zFactor * Math.hypot(dzdx, dzdy));
      // Aspect: direction the slope faces, clockwise from north.
      const aspectRad = Math.atan2(dzdx, -dzdy);
      let shade =
        Math.cos(zenithRad) * Math.cos(slopeRad) +
        Math.sin(zenithRad) * Math.sin(slopeRad) * Math.cos(azimuthRad - aspectRad);
      if (!Number.isFinite(shade)) shade = 0;
      out[r * nx + c] = Math.min(1, Math.max(0, shade));
    }
  }
  return out;
}

/**
 * Modulate an RGB triplet array (length 3*n, row-major) by a hillshade field.
 * `floor` keeps shadowed cells visible (default 0.45): out = rgb * (floor + (1-floor) * shade).
 */
export function applyHillshadeToColors(
  rgb: Float32Array,
  shade: Float64Array,
  floor = 0.45,
): Float32Array {
  if (rgb.length !== shade.length * 3) {
    throw new Error('[flood-sim-hillshade] rgb/shade length mismatch');
  }
  const out = new Float32Array(rgb.length);
  for (let i = 0; i < shade.length; i += 1) {
    const m = floor + (1 - floor) * shade[i];
    out[i * 3] = rgb[i * 3] * m;
    out[i * 3 + 1] = rgb[i * 3 + 1] * m;
    out[i * 3 + 2] = rgb[i * 3 + 2] * m;
  }
  return out;
}
