/** Phase 2 — Engineering interaction contract. */

export type EngineeringToolId =
  | "parcel_select"
  | "measure_distance"
  | "measure_area"
  | "elevation_sample"
  | "survey_point"
  | "asset_inspect"
  | "source_verify"
  | "overlay_toggle"
  | "scenario_manage"
  | "hec_ras_playback_readonly";

export type MeasurementResult = {
  tool: EngineeringToolId;
  value: number;
  unit: "ft" | "m" | "ft2" | "m2";
  verticalDatum?: "NAVD88" | "GAGE_DATUM" | "ELLIPSOID" | "UNKNOWN";
  authority: "MODEL_SIMULATION" | "OBSERVATION" | "DERIVED";
  disclaimer: string;
};

export function elevationSampleDisclaimer(datum: string): string {
  return `Elevation sample in ${datum}. Screening DEM is DERIVED — not PE survey LAG/BFE.`;
}

export type ScenarioRecord = {
  id: string;
  name: string;
  createdAt: string;
  lagFt: number | null;
  bfeFt: number | null;
  freeboardFt: number | null;
  authority: "MODEL_SIMULATION";
};

export function createScenarioDraft(name: string, lagFt: number, bfeFt: number): ScenarioRecord {
  return {
    id: `scn_${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    lagFt,
    bfeFt,
    freeboardFt: lagFt - bfeFt,
    authority: "MODEL_SIMULATION",
  };
}

/** Read-only HEC-RAS playback: never launches solver. */
export function hecRasReadonlyPlaybackStatus(): {
  mode: "READONLY_PLAYBACK";
  canInvokeSolver: false;
  guidance: string;
} {
  return {
    mode: "READONLY_PLAYBACK",
    canInvokeSolver: false,
    guidance:
      "Import human-exported WSE/depth; play timeline only. Solver stays external (ras-commander / HEC-RAS).",
  };
}

export const ENGINEERING_TOOLS: readonly EngineeringToolId[] = [
  "parcel_select",
  "measure_distance",
  "measure_area",
  "elevation_sample",
  "survey_point",
  "asset_inspect",
  "source_verify",
  "overlay_toggle",
  "scenario_manage",
  "hec_ras_playback_readonly",
] as const;
