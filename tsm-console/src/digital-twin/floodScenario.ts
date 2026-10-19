/**
 * floodScenario.ts — Flood scenario registry for the TSM digital twin.
 *
 * HONESTY RULE: crest stages, dates, gauge IDs, and flood stages below are
 * sourced from the records cited in each scenario's `sources` field. Anything
 * not sourced is marked "unavailable" — never invented. All depth/extent
 * outputs derived from these scenarios are SIMULATION, not observations.
 */

export type FloodScenarioId =
  | "live"
  | "100yr"
  | "500yr"
  | "historical-1937"
  | "historical-2011";

export interface FloodScenarioCrest {
  /** USGS/NWS gauge identifier, e.g. "MTVI3", "03322000". */
  gaugeId: string;
  /** Human-readable gauge name. */
  gaugeName: string;
  /** Peak stage in feet, as reported by the gauge's datum. */
  crestStageFt: number;
  /** Date of the crest (ISO date). */
  crestDate: string;
  /** Flood stage for this gauge in feet, if published. Null if unknown. */
  floodStageFt: number | null;
}

export interface FloodScenario {
  id: FloodScenarioId;
  label: string;
  sourceDataset: string | null;
  sourceUri: string | null;
  recurrenceIntervalYears: number | null;
  historicalDate: string | null;
  floodDepthAsset: string | null;
  floodExtentAsset: string | null;
  verticalDatum: string | null;
  horizontalCrs: string | null;
  evidenceId: string | null;
  status: "verified" | "unverified" | "unavailable";
  /** Observed crest records. Empty when no crest data is sourced. */
  crests: readonly FloodScenarioCrest[];
  /** Free-text provenance and caveats. */
  notes: string;
  /** URLs or document paths backing the sourced values. */
  sources: readonly string[];
}

export const FLOOD_SCENARIOS: readonly FloodScenario[] = [
  {
    id: "live",
    label: "Live simulation",
    sourceDataset: null,
    sourceUri: null,
    recurrenceIntervalYears: null,
    historicalDate: null,
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: null,
    horizontalCrs: null,
    evidenceId: null,
    status: "unavailable",
    crests: [],
    notes:
      "No live flood-depth feed is wired into the console. Live river levels " +
      "are fetched on demand via the River Watch 'Fetch live snapshot' button " +
      "(USGS NWIS / NWS NWPS), but no live inundation-depth product exists to " +
      "drive this scenario.",
    sources: [],
  },
  {
    id: "100yr",
    label: "100-year flood (1% annual chance)",
    sourceDataset: "FEMA FIRM panel 18129C0265C (effective 2014-11-05), Posey County IN",
    sourceUri: "data/fema/18129C0265C/README.md",
    recurrenceIntervalYears: 100,
    historicalDate: null,
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: "NAVD88",
    horizontalCrs: "EPSG:4326",
    evidenceId: null,
    status: "unverified",
    crests: [],
    notes:
      "Regulatory design event anchored to the FEMA-effective BFE of " +
      "369.1 ft NAVD88 at 13101 Bonebank Rd (FIS 18129CV000A Table 9, " +
      "Section A, RM 844.75; FIRM panel 18129C0265C, Zone AE). " +
      "Corrected 2026-10-18 from the 375.0 ft working target in " +
      "Bonebank_LOMA_Checklist.pdf. See data/scenarios/q100-design-event.json " +
      "for the provisional screening replay (simulation).",
    sources: [
      "docs/validation/site-gaps-research-2026-10-17.md (BFE investigation)",
      "data/scenarios/q100-design-event.json",
    ],
  },
  {
    id: "500yr",
    label: "500-year flood (0.2% annual chance)",
    sourceDataset: null,
    sourceUri: null,
    recurrenceIntervalYears: 500,
    historicalDate: null,
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: null,
    horizontalCrs: null,
    evidenceId: null,
    status: "unavailable",
    crests: [],
    notes:
      "No 500-year flood elevation, depth grid, or extent polygon is sourced " +
      "anywhere in the TSM repository for the tri-state area. FEMA Zone X " +
      "(shaded) areas exist on the FIRM but no numeric 0.2%-annual-chance " +
      "elevation is on file. Marked unavailable rather than estimated.",
    sources: [],
  },
  {
    id: "historical-1937",
    label: "1937 Great Ohio River Flood",
    sourceDataset: "NWS AHPS historic crests; USGS NWIS; TSM site research",
    sourceUri: "https://water.weather.gov/ahps2/index.php?wfo=pah",
    recurrenceIntervalYears: null,
    historicalDate: "1937-01-31",
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: "NAVD88",
    horizontalCrs: "EPSG:4326",
    evidenceId: null,
    status: "verified",
    crests: [
      {
        gaugeId: "MTVI3",
        gaugeName: "Ohio River at Mount Vernon, IN (NWS)",
        crestStageFt: 59.21,
        crestDate: "1937-01-27",
        floodStageFt: 35.0,
      },
      {
        gaugeId: "03322000",
        gaugeName: "Ohio River at Evansville, IN (USGS)",
        crestStageFt: 53.75,
        crestDate: "1937-01-31",
        floodStageFt: 42.0,
      },
    ],
    notes:
      "VERIFIED crest values only. Mount Vernon: 59.21 ft stage on the MTVI3 " +
      "gauge; gauge zero 318.59 ft NAVD88 → crest elevation 377.80 ft NAVD88, " +
      "matching the recorded 377.8 ft (docs/validation/site-gaps-research-2026-10-17.md). " +
      "Evansville: 53.75 ft on 1937-01-31, the highest crest on record at that " +
      "gauge (NWS records via the-hendersonian.com). The crest DATE at Mount " +
      "Vernon (Jan 27) vs Evansville (Jan 31) reflects downstream travel time. " +
      "No 1937 rainfall time series, surveyed terrain, or depth grid exists in " +
      "the repository — see data/scenarios/1937-ohio-river-flood.json for the " +
      "provisional screening replay (simulation; only the Evansville 54.0 ft " +
      "stage cited there is sourced).",
    sources: [
      "docs/validation/site-gaps-research-2026-10-17.md (Mount Vernon 59.21 ft stage, gauge zero 318.59 ft NAVD88)",
      "https://the-hendersonian.com/ohio-river-reaches-crest-highest-in-a-half-century/ (NWS Evansville top-10 crests: 53.75 ft on 01-31-1937)",
      "data/scenarios/1937-ohio-river-flood.json",
    ],
  },
  {
    id: "historical-2011",
    label: "May 2011 Ohio & Wabash River Flood",
    sourceDataset: "NASA Earth Observatory; NWS AHPS",
    sourceUri: "https://science.nasa.gov/earth/earth-observatory/flooding-along-the-wabash-and-ohio-rivers-50470/",
    recurrenceIntervalYears: null,
    historicalDate: "2011-05-05",
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: "NAVD88",
    horizontalCrs: "EPSG:4326",
    evidenceId: null,
    status: "verified",
    crests: [
      {
        gaugeId: "EVVI3",
        gaugeName: "Ohio River at Evansville, IN (NWS)",
        crestStageFt: 46.78,
        crestDate: "2011-05-05",
        floodStageFt: 42.0,
      },
      {
        gaugeId: "JTMD3",
        gaugeName: "Ohio River at J.T. Myers Lock and Dam (NWS)",
        crestStageFt: 56.94,
        crestDate: "2011-05-05",
        floodStageFt: 37.0,
      },
      {
        gaugeId: "03378500",
        gaugeName: "Wabash River at New Harmony, IN (USGS)",
        crestStageFt: 23.67,
        crestDate: "2011-05-05",
        floodStageFt: 15.0,
      },
    ],
    notes:
      "VERIFIED crest values from NASA Earth Observatory (May 5, 2011), citing " +
      "NWS AHPS. The J.T. Myers crest (56.94 ft) was the highest recorded there " +
      "since 1937; the Wabash at New Harmony (23.67 ft) was the highest since " +
      "1943. Forecast context: on April 30, 2011 the Ohio was forecast to crest " +
      "at the dam at 'just over 54 feet'. No Mount Vernon (MTVI3) 2011 crest is " +
      "sourced in the repository — not invented here. No 2011 depth grid or " +
      "extent polygon is held in the repository; any replay is simulation.",
    sources: [
      "https://science.nasa.gov/earth/earth-observatory/flooding-along-the-wabash-and-ohio-rivers-50470/ (Evansville 46.78 ft; J.T. Myers 56.94 ft; New Harmony 23.67 ft)",
      "https://the-hendersonian.com/ohio-river-reaches-crest-highest-in-a-half-century/ (NWS Evansville top-10: 46.78 ft on 05-05-2011)",
    ],
  },
];

export function requireVerifiedScenario(id: FloodScenarioId): FloodScenario {
  const scenario = FLOOD_SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown flood scenario: ${id}`);
  if (scenario.status !== "verified") {
    throw new Error(`Flood scenario ${id} is not backed by verified source data`);
  }
  return scenario;
}

export function getScenario(id: FloodScenarioId): FloodScenario | undefined {
  return FLOOD_SCENARIOS.find((candidate) => candidate.id === id);
}

/** Crest stages in feet for a scenario, keyed by gauge ID. Empty when unsourced. */
export function crestStagesByGauge(
  id: FloodScenarioId,
): Readonly<Record<string, number>> {
  const scenario = getScenario(id);
  if (!scenario) return {};
  const out: Record<string, number> = {};
  for (const crest of scenario.crests) out[crest.gaugeId] = crest.crestStageFt;
  return out;
}
