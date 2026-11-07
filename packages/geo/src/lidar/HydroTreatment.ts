/**
 * Hydro-flattening vs hydro-enforcement vs hydro-conditioning — constraint
 * builders and thresholds for DEM surface treatments.
 *
 * Sources (verified 2026-11-07):
 * - USGS LBS 2025 rev. A, "DEM Surface Treatments":
 *   https://www.usgs.gov/ngp-standards-and-specifications/lidar-base-specification-digital-elevation-model-surface
 * - USGS 3DEP hydro-treatment lesson (flattened water carries zero water-
 *   surface accuracy — it is a cartographic/aesthetic enhancement only).
 * - NSGIC / USGS EDH hydro-enhancement presentation for the enforcement /
 *   conditioning definitions.
 *
 * The distinction, in one line each:
 * - Hydro-FLATTENING: cartographic. Flat ponds, bank-to-bank level rivers
 *   with a downhill gradient. The DEM changes; the point cloud does not.
 * - Hydro-ENFORCEMENT: drainage connectivity. Elevations are removed from
 *   the tops of selected drainage structures (bridges, culverts) so models
 *   depict water flowing under them.
 * - Hydro-CONDITIONING: further edits (fill sinks, breach barriers) so
 *   every cell flows towards a stream network and an outlet.
 *
 * TSM rule: a hydro-flattened DEM is mapping / twin terrain only. A
 * hydro-enforced surface is a model input only, with explicit provenance.
 * Neither is a regulatory water surface — the FEMA BFE is the regulatory
 * authority, not the DEM. Flattened water elevations are estimated from
 * adjacent terrain and must not be used for water volume, flow, or H&H
 * modelling.
 *
 * These builders only assemble and validate breakline constraint sets.
 * No code in this package performs flattening, enforcement, conditioning,
 * or breakline extraction from lidar/DEM data.
 */
import type { ValidationResult } from "../geodesy/CoordinateReference.js";

/** How a DEM surface was treated hydrologically. A label must reflect what was actually done. */
export type DemTreatment = "raw_lidar_tin" | "hydro_flattened" | "hydro_enforced" | "hydro_conditioned";

export type BreaklineKind = "lake" | "river" | "bridge" | "culvert_cut";

export interface Breakline {
  id: string;
  kind: BreaklineKind;
  /**
   * 3D vertices. Lakes: a single elevation for the perimeter. Rivers:
   * elevations must decrease monotonically downstream (enforced by
   * `validateMonotonicRiver` / `assertMonotonicRiver`).
   */
  vertices: Array<{ x: number; y: number; z: number }>;
}

/** Waterbodies with a surface area of this size or greater shall be flattened (LBS). */
export const MIN_FLATTENED_WATERBODY_AREA_HA = 0.8;
/** Streams and rivers of this nominal width or greater shall be flattened (LBS). */
export const MIN_FLATTENED_STREAM_WIDTH_M = 30;
/** Islands of this size or greater are delineated (LBS). */
export const MIN_DELINEATED_ISLAND_AREA_HA = 0.4;
/**
 * Upper bound on the ignored-ground buffer around breaklines, as a multiple
 * of aggregate nominal pulse spacing (ANPS). The LBS leaves the threshold to
 * the data producer and states only that it "in general should not exceed
 * twice the ANPS" — this is an upper bound, not a fixed buffer.
 */
export const MAX_IGNORED_GROUND_BUFFER_ANPS_MULTIPLE = 2;

/**
 * Validate that a river breakline's elevations decrease monotonically
 * downstream (LBS: flattened rivers "shall present a gradient downhill
 * water surface"). Non-river breaklines are trivially valid. A river with
 * fewer than two vertices has nothing to check and is valid.
 */
export function validateMonotonicRiver(bl: Breakline): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (bl.kind !== "river") return { valid: true, errors, warnings };
  for (let i = 1; i < bl.vertices.length; i++) {
    if (bl.vertices[i].z > bl.vertices[i - 1].z + 1e-6) {
      errors.push(`RIVER_NOT_DOWNHILL:${bl.id}:vertex:${i}`);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Throw when a river breakline rises downstream. For callers that want
 * fail-fast validation of supplied breaklines; prefer
 * `validateMonotonicRiver` when the result should be reported rather than
 * thrown.
 */
export function assertMonotonicRiver(bl: Breakline): void {
  const result = validateMonotonicRiver(bl);
  if (!result.valid) {
    throw new Error(`River ${bl.id} not downhill: ${result.errors.join(", ")}`);
  }
}

/**
 * Flattening constraint set: lakes and rivers only, with every river
 * checked monotonic downhill. Bridges and culvert cuts are not flattening
 * constraints — a bridge is removed from the DEM and a culvert is an
 * enforcement cut, not a flattening feature.
 */
export function buildHydroFlattenConstraints(breaklines: readonly Breakline[]): Breakline[] {
  return breaklines
    .filter((b) => b.kind === "lake" || b.kind === "river")
    .map((b) => {
      assertMonotonicRiver(b);
      return b;
    });
}

/**
 * Enforcement constraint set: culvert cuts, rivers, and lakes — the
 * features whose elevations are adjusted so drainage connectivity is
 * depicted (water flowing under structures). Bridges are not included:
 * enforcement removes the bridge deck from the surface rather than
 * constraining through it. This only assembles the set; it performs no
 * enforcement.
 */
export function buildHydroEnforceConstraints(breaklines: readonly Breakline[]): Breakline[] {
  return breaklines.filter((b) => b.kind === "culvert_cut" || b.kind === "river" || b.kind === "lake");
}
