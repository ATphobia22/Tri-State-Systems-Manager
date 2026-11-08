/**
 * Display-only COGO checks for the TSM console (EPSG:2966 planar feet).
 *
 * These are the same planar formulas the backend survey package wraps
 * (pySurveying convention: x = easting, y = northing, azimuths in
 * degrees clockwise from north), reimplemented here in dependency-free
 * TypeScript so the console can show an inverse / traverse closure
 * check without a backend round-trip.
 *
 * Display only — no new dependency, no reprojection, no evidence use.
 * Every result is flagged `provisional: true` and carries the same
 * display-transform note as `proj4-display.ts`: client-side numbers
 * are for map UX only; regulatory coordinates require the documented
 * NGS chain + human gate. Nothing here is a survey certification.
 */

import { DISPLAY_TRANSFORM_NOTE } from './proj4-display';

export const COGO_DISPLAY_NOTE =
  'Display-only COGO check on EPSG:2966 planar coordinates. ' +
  DISPLAY_TRANSFORM_NOTE;

export interface PlanarPoint {
  x: number;
  y: number;
}

export interface Provisional {
  provisional: true;
  note: string;
}

export interface InverseResult extends Provisional {
  from: PlanarPoint;
  to: PlanarPoint;
  distanceUsFt: number;
  azimuthDeg: number;
}

export interface TraverseCheckResult extends Provisional {
  method: string;
  coordinates: PlanarPoint[];
  misclosureXUsFt: number;
  misclosureYUsFt: number;
  linearMisclosureUsFt: number;
  totalLengthUsFt: number;
  /** Relative precision (total length / misclosure); null when zero. */
  relativePrecision: number | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeAzimuth(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function checkPoint(point: PlanarPoint, name: string): PlanarPoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${name} must have finite x and y`);
  }
  return { x: point.x, y: point.y };
}

/**
 * Inverse between two EPSG:2966 planar points: distance and surveying
 * azimuth (degrees, clockwise from north).
 */
export function inverseDisplay(from: PlanarPoint, to: PlanarPoint): InverseResult {
  const p1 = checkPoint(from, 'from');
  const p2 = checkPoint(to, 'to');
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return {
    provisional: true,
    note: COGO_DISPLAY_NOTE,
    from: p1,
    to: p2,
    distanceUsFt: Math.hypot(dx, dy),
    azimuthDeg: normalizeAzimuth((Math.atan2(dx, dy) * 180) / Math.PI),
  };
}

/**
 * Forward from a point along an azimuth for a distance (planar feet).
 */
export function forwardDisplay(
  from: PlanarPoint,
  azimuthDeg: number,
  distanceUsFt: number,
): PlanarPoint & Provisional {
  const p1 = checkPoint(from, 'from');
  if (!Number.isFinite(azimuthDeg) || !Number.isFinite(distanceUsFt)) {
    throw new Error('azimuth and distance must be finite');
  }
  if (distanceUsFt < 0) {
    throw new Error('distance must be non-negative');
  }
  const rad = toRadians(azimuthDeg);
  return {
    provisional: true,
    note: COGO_DISPLAY_NOTE,
    x: p1.x + distanceUsFt * Math.sin(rad),
    y: p1.y + distanceUsFt * Math.cos(rad),
  };
}

/**
 * Bowditch closure check for a closed traverse: one azimuth and one
 * distance per leg, starting at `start` and closing back on it.
 * Misclosure is reported, never hidden.
 */
export function closedTraverseDisplayCheck(
  start: PlanarPoint,
  azimuthsDeg: number[],
  distancesUsFt: number[],
): TraverseCheckResult {
  const p0 = checkPoint(start, 'start');
  if (azimuthsDeg.length !== distancesUsFt.length) {
    throw new Error('azimuths and distances must have the same length');
  }
  if (azimuthsDeg.length === 0) {
    throw new Error('a traverse needs at least one leg');
  }
  if (distancesUsFt.some((d) => !Number.isFinite(d) || d <= 0)) {
    throw new Error('distances must be finite and positive');
  }
  const total = distancesUsFt.reduce((sum, d) => sum + d, 0);
  let dxSum = 0;
  let dySum = 0;
  const increments = azimuthsDeg.map((azimuth, i) => {
    const rad = toRadians(azimuth);
    const dx = distancesUsFt[i] * Math.sin(rad);
    const dy = distancesUsFt[i] * Math.cos(rad);
    dxSum += dx;
    dySum += dy;
    return { dx, dy };
  });
  // Raw closure error: start + increments - start = (dxSum, dySum).
  const fx = dxSum;
  const fy = dySum;
  const linear = Math.hypot(fx, fy);
  const coordinates: PlanarPoint[] = [{ x: p0.x, y: p0.y }];
  let x = p0.x;
  let y = p0.y;
  increments.forEach((inc, i) => {
    const cx = -fx * (distancesUsFt[i] / total);
    const cy = -fy * (distancesUsFt[i] / total);
    x += inc.dx + cx;
    y += inc.dy + cy;
    coordinates.push({ x, y });
  });
  return {
    provisional: true,
    note: COGO_DISPLAY_NOTE,
    method: 'Bowditch (closed traverse, display check)',
    coordinates,
    misclosureXUsFt: fx,
    misclosureYUsFt: fy,
    linearMisclosureUsFt: linear,
    totalLengthUsFt: total,
    relativePrecision: linear === 0 ? null : total / linear,
  };
}
