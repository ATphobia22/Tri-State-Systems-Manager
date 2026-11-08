/**
 * Point-level classification helpers for lidar point clouds.
 *
 * These are small, pure, tested utilities. They are NOT a ground filter:
 * there is no progressive TIN densification, morphological filter, cloth
 * simulation, or multiscale curvature implementation in this package.
 * Real ground filtering lives in `scripts/geospatial/pdal_pipelines.py`
 * (PDAL SMRF) and in `docs/PDAL-CLASSIFICATION-LOGIC.md`; do not mistake
 * these helpers for that step. In particular, a function that merely seeds
 * lowest-per-cell points and demotes every other class-2 point to class 1
 * would destroy ground classification — no such function exists here.
 *
 * Class codes: see `./LidarClasses.ts` (ASPRS / USGS LBS, verified).
 * Vegetation bands: see `DEFAULT_VEGETATION_BANDS` below — they are a
 * project convention, NOT an LBS standard (the LBS defines no heights for
 * classes 3/4/5; verified 2026-11-07).
 */
import { LIDAR_CLASS } from "./LidarClasses.js";

export interface LidarPoint {
  x: number;
  y: number;
  z: number;
  intensity?: number;
  returnNumber?: number;
  /** ASPRS / USGS class code. */
  classification: number;
}

/**
 * Reclassify ground points near a breakline as Ignored Ground (class 20),
 * per USGS LBS DEM Surface Treatments: "Bare-earth lidar points … in close
 * proximity to any breakline shall be classified as Ignored Ground
 * (class 20) and shall be excluded from the DEM generation process."
 * Source: https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-digital-elevation-model-surface
 *
 * The LBS leaves the proximity threshold to the data producer, with an
 * upper bound of twice the aggregate nominal pulse spacing (ANPS) — it is
 * NOT a fixed 2x ANPS rule. Callers pass their chosen threshold in metres
 * (`maxDistanceM`) and a distance function; the threshold is the caller's
 * documented decision. Only class-2 points are reclassed; every other
 * point is returned unchanged. Inputs are never mutated.
 */
export function markIgnoredGroundNearBreaklines(
  points: readonly LidarPoint[],
  maxDistanceM: number,
  distanceToBreakline: (p: LidarPoint) => number,
): LidarPoint[] {
  if (!Number.isFinite(maxDistanceM) || maxDistanceM < 0) {
    throw new RangeError(`maxDistanceM must be a finite number >= 0, got ${maxDistanceM}`);
  }
  return points.map((p) => {
    if (p.classification === LIDAR_CLASS.GROUND && distanceToBreakline(p) <= maxDistanceM) {
      return { ...p, classification: LIDAR_CLASS.IGNORED_GROUND };
    }
    return p;
  });
}

/**
 * Height-above-ground vegetation bands, in metres.
 *
 * The USGS LBS defines NO heights for classes 3/4/5 — the bands are a
 * project convention and vary by project (verified 2026-11-07):
 * - Most common metric convention: low 0.5–2 m, medium 2–6 m, high 6+ m.
 * - Imperial convention in USGS project reports: low 0.5–5 ft,
 *   medium 5–20 ft, high >20 ft (≈0.15–1.52 m, 1.52–6.10 m, >6.10 m).
 * - A third variant: low 0.5–2 m, medium 2–5 m, high >5 m.
 *
 * The default below is the most common metric convention. Low vegetation
 * STARTS at 0.5 m: points below that are near-ground returns, not low
 * vegetation, and are left unchanged. Pass explicit bands for any project
 * that uses a different convention — never silently relabel.
 */
export interface VegetationBands {
  /** Lower bound of low vegetation, in metres. Points below this are left unchanged. */
  lowMinM: number;
  /** Upper bound of low vegetation / lower bound of medium vegetation, in metres. */
  lowMaxM: number;
  /** Upper bound of medium vegetation / lower bound of high vegetation, in metres. */
  mediumMaxM: number;
}

export const DEFAULT_VEGETATION_BANDS: VegetationBands = {
  lowMinM: 0.5,
  lowMaxM: 2.0,
  mediumMaxM: 6.0,
};

function validateVegetationBands(bands: VegetationBands): void {
  const { lowMinM, lowMaxM, mediumMaxM } = bands;
  if (![lowMinM, lowMaxM, mediumMaxM].every((v) => Number.isFinite(v))) {
    throw new RangeError("Vegetation bands must all be finite numbers");
  }
  if (lowMinM < 0 || lowMaxM <= lowMinM || mediumMaxM <= lowMaxM) {
    throw new RangeError(
      `Vegetation bands must satisfy 0 <= lowMinM < lowMaxM < mediumMaxM, got ${lowMinM}/${lowMaxM}/${mediumMaxM}`,
    );
  }
}

/**
 * Band non-ground points into low / medium / high vegetation (classes 3/4/5)
 * by height above ground.
 *
 * - Ground (class 2) points are returned unchanged.
 * - Points whose ground elevation is unknown (`groundZ` returns null) are
 *   returned unchanged — no height is invented.
 * - Points with height above ground below `lowMinM` are returned unchanged.
 * - Otherwise: [lowMinM, lowMaxM) → class 3, [lowMaxM, mediumMaxM) →
 *   class 4, >= mediumMaxM → class 5.
 * Inputs are never mutated. Bands are explicit parameters; the default is
 * the most common metric project convention (see `DEFAULT_VEGETATION_BANDS`).
 */
export function classifyVegetationByHag(
  points: readonly LidarPoint[],
  groundZ: (p: LidarPoint) => number | null,
  bands: VegetationBands = DEFAULT_VEGETATION_BANDS,
): LidarPoint[] {
  validateVegetationBands(bands);
  return points.map((p) => {
    if (p.classification === LIDAR_CLASS.GROUND) return p;
    const gz = groundZ(p);
    if (gz === null || !Number.isFinite(gz)) return p;
    const hag = p.z - gz;
    if (hag < bands.lowMinM) return p;
    if (hag < bands.lowMaxM) return { ...p, classification: LIDAR_CLASS.LOW_VEGETATION };
    if (hag < bands.mediumMaxM) return { ...p, classification: LIDAR_CLASS.MEDIUM_VEGETATION };
    return { ...p, classification: LIDAR_CLASS.HIGH_VEGETATION };
  });
}
