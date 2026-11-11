/**
 * Uncertainty Lens — make scientific limitations visible in the twin, not hidden by graphics.
 */

export type UncertaintyKind =
  | "missing_observation"
  | "estimated_building_height"
  | "unknown_building_height"
  | "uncalibrated_hydraulic_model"
  | "datum_uncertainty"
  | "terrain_derived_only"
  | "coverage_gap";

export type UncertaintyMarker = {
  id: string;
  kind: UncertaintyKind;
  severity: "info" | "warning" | "critical";
  message: string;
  lon?: number;
  lat?: number;
  authorityNote: string;
};

export function defaultPoseyUncertaintyMarkers(): UncertaintyMarker[] {
  return [
    {
      id: "u-terrain-derived",
      kind: "terrain_derived_only",
      severity: "info",
      message: "3DEP/Terrain-RGB elevations are DERIVED screening — not PE survey LAG",
      authorityNote: "DERIVED",
    },
    {
      id: "u-unknown-heights",
      kind: "unknown_building_height",
      severity: "warning",
      message: "Retain footprints with explicit unknown height; do not invent LOD2 roofs",
      authorityNote: "HONEST_INVENTORY",
    },
    {
      id: "u-hec-import",
      kind: "uncalibrated_hydraulic_model",
      severity: "warning",
      message: "HEC-RAS results are imported read-only; TSM does not validate the model",
      authorityNote: "MODEL_SIMULATION",
    },
    {
      id: "u-gage-datum",
      kind: "datum_uncertainty",
      severity: "info",
      message: "Stage remains GAGE_DATUM until product-matched zero is applied per station",
      authorityNote: "OBSERVATION",
    },
  ];
}
