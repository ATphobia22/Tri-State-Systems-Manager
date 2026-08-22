export type FloodScenarioId = "live" | "100yr" | "500yr" | "historical-1937";

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
  },
  {
    id: "100yr",
    label: "100-year flood",
    sourceDataset: null,
    sourceUri: null,
    recurrenceIntervalYears: 100,
    historicalDate: null,
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: null,
    horizontalCrs: null,
    evidenceId: null,
    status: "unavailable",
  },
  {
    id: "500yr",
    label: "500-year flood",
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
  },
  {
    id: "historical-1937",
    label: "1937 historical flood",
    sourceDataset: null,
    sourceUri: null,
    recurrenceIntervalYears: null,
    historicalDate: "1937",
    floodDepthAsset: null,
    floodExtentAsset: null,
    verticalDatum: null,
    horizontalCrs: null,
    evidenceId: null,
    status: "unavailable",
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
