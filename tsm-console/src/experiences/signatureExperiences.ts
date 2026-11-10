/**
 * Three signature TSM experiences — product contracts with real-world sources.
 * Human authority remains final.
 */

export type ExperienceId =
  | "living-river-valley"
  | "engineering-scenario-sandbox"
  | "evidence-to-cinema-storyboard";

export type DataSourceRef = {
  name: string;
  authority: "REGULATORY" | "OBSERVATION" | "DERIVED" | "MODEL_SIMULATION" | "PRESENTATION";
  url?: string;
  use: string;
};

export type SignatureExperience = {
  id: ExperienceId;
  title: string;
  promise: string;
  routePath: string;
  sources: DataSourceRef[];
  mathContracts: string[];
  neverClaims: string[];
};

export const SIGNATURE_EXPERIENCES: readonly SignatureExperience[] = Object.freeze([
  {
    id: "living-river-valley",
    title: "The Living River Valley",
    promise:
      "A cinematic, time-aware, explorable regional environment with searchable places and interactive engineering layers.",
    routePath: "/experience/living-river",
    sources: [
      {
        name: "FEMA NFHL / MSC",
        authority: "REGULATORY",
        url: "https://msc.fema.gov",
        use: "SFHA / FIRM panel context — not replaced by terrain-rgb",
      },
      {
        name: "USGS 3DEP",
        authority: "DERIVED",
        url: "https://www.usgs.gov/3d-elevation-program",
        use: "Screening terrain — DERIVED / non-FIRM",
      },
      {
        name: "NOAA NWPS MTVI3",
        authority: "OBSERVATION",
        url: "https://water.noaa.gov/gauges/mtvi3",
        use: "Stage in GAGE_DATUM; zero 318.59 ft NAVD88 from product table only",
      },
      {
        name: "USGS NWIS / OGC",
        authority: "OBSERVATION",
        use: "Gage height/discharge time series — station-specific datums",
      },
      {
        name: "Indiana IGIO / parcels",
        authority: "REGULATORY",
        use: "Cadastre context for Posey County",
      },
    ],
    mathContracts: [
      "Stage stays GAGE_DATUM until WSE = stage + published_station_gage_zero",
      "MTVI3: gage zero 318.59 ft NAVD88 (NWPS vertical datum table)",
      "Map layers labeled OBSERVATION vs DERIVED vs REGULATORY",
    ],
    neverClaims: [
      "Not an official flood warning system",
      "3DEP is not survey LAG",
      "Cinema camera paths do not change evidence",
    ],
  },
  {
    id: "engineering-scenario-sandbox",
    title: "The Engineering Scenario Sandbox",
    promise:
      "Draw, calculate, compare, and inspect alternative projects with reproducible mathematics and explicit uncertainty.",
    routePath: "/experience/scenario-sandbox",
    sources: [
      {
        name: "Site constants / PE inputs",
        authority: "MODEL_SIMULATION",
        use: "LAG/BFE only when user or PE supplies; modeling defaults labeled",
      },
      {
        name: "Freeboard formula",
        authority: "MODEL_SIMULATION",
        use: "freeboard = LAG − BFE (same vertical datum required)",
      },
      {
        name: "HEC-RAS / SWMM bridges",
        authority: "MODEL_SIMULATION",
        use: "External solvers; import human-reviewed results only",
      },
      {
        name: "FIS / BFE tables",
        authority: "REGULATORY",
        use: "Regulatory BFE when cited from effective FIS/FIRM",
      },
    ],
    mathContracts: [
      "freeboard_ft = LAG_ft − BFE_ft (identical vertical datum)",
      "inundation depth = max(0, WSE − ground)",
      "Uncertainty: declare DEM RMSE / survey class; do not hide",
      "Scenario diffs are MODEL_SIMULATION until PE signs",
    ],
    neverClaims: [
      "Sandbox output is not a LOMA",
      "No auto-filing to FEMA",
      "Compensatory storage factors remain labeled assumptions",
    ],
  },
  {
    id: "evidence-to-cinema-storyboard",
    title: "The Evidence-to-Cinema Storyboard",
    promise:
      "Convert validated analysis into compelling visual explanations without changing what the underlying evidence establishes.",
    routePath: "/experience/evidence-storyboard",
    sources: [
      {
        name: "Evidence ledger / case JSON",
        authority: "OBSERVATION",
        use: "Hashed artifacts; human authorization flags",
      },
      {
        name: "NFHL panel query / MSC products",
        authority: "REGULATORY",
        use: "Panel IDs and zones as queried",
      },
      {
        name: "Storyboard shots",
        authority: "PRESENTATION",
        use: "Camera + narration only — cannot mutate evidence hashes",
      },
    ],
    mathContracts: [
      "Storyboard frames reference evidence IDs; they do not recompute LAG/BFE silently",
      "If evidence is GAGE_DATUM, cinema labels GAGE_DATUM",
      "SIMULATION_DEMO watermark when terrain is illustrative",
    ],
    neverClaims: [
      "Cinema is not a regulatory determination",
      "Visual polish cannot upgrade DERIVED to REGULATORY",
    ],
  },
]);

export function getSignatureExperience(id: ExperienceId): SignatureExperience | undefined {
  return SIGNATURE_EXPERIENCES.find((e) => e.id === id);
}
