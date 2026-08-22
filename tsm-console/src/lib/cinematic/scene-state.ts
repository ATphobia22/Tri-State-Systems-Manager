export type FloodScenarioId = 'live' | '100-year' | '500-year' | '1937-historic';
export type EvidenceStatus = 'UNBOUND' | 'VERIFIED' | 'STALE' | 'INVALID';

export interface GeospatialBounds { minX: number; minY: number; maxX: number; maxY: number; }

export interface OrthophotoAsset {
  assetId: string;
  uri: string;
  contentHash: string;
  horizontalCrs: string;
  bounds: GeospatialBounds;
  pixelWidth: number;
  pixelHeight: number;
  resolutionX: number;
  resolutionY: number;
  units: string;
  bandCount: number;
  nodata: number | null;
  evidenceId: string;
}

export interface FloodScenario {
  id: FloodScenarioId;
  label: string;
  recurrenceIntervalYears: number | null;
  historicalDate: string | null;
  status: EvidenceStatus;
  floodDepthAssetId: string | null;
  floodExtentAssetId: string | null;
  evidenceId: string | null;
  sourceDescription: string | null;
}

export interface SolarLightingState {
  simulationTime: string;
  latitudeDegrees: number;
  longitudeDegrees: number;
  timezoneOffsetMinutes: number;
  solarAzimuthDegrees: number;
  solarElevationDegrees: number;
  sunDirection: [number, number, number];
  ambientIntensity: number;
}

export interface SceneState {
  schemaVersion: '1.0.0';
  timestamp: string;
  orthophoto: OrthophotoAsset | null;
  activeFloodScenario: FloodScenarioId;
  floodScenarios: readonly FloodScenario[];
  solar: SolarLightingState;
}

export const DEFAULT_FLOOD_SCENARIOS: readonly FloodScenario[] = [
  { id: 'live', label: 'Telemetry Live Stream', recurrenceIntervalYears: null, historicalDate: null, status: 'UNBOUND', floodDepthAssetId: null, floodExtentAssetId: null, evidenceId: null, sourceDescription: null },
  { id: '100-year', label: '100-Year Base Flood', recurrenceIntervalYears: 100, historicalDate: null, status: 'UNBOUND', floodDepthAssetId: null, floodExtentAssetId: null, evidenceId: null, sourceDescription: null },
  { id: '500-year', label: '500-Year Flood', recurrenceIntervalYears: 500, historicalDate: null, status: 'UNBOUND', floodDepthAssetId: null, floodExtentAssetId: null, evidenceId: null, sourceDescription: null },
  { id: '1937-historic', label: '1937 Historical Flood', recurrenceIntervalYears: null, historicalDate: '1937', status: 'UNBOUND', floodDepthAssetId: null, floodExtentAssetId: null, evidenceId: null, sourceDescription: null },
];

export function selectFloodScenario(scenarios: readonly FloodScenario[], id: FloodScenarioId): FloodScenario {
  const scenario = scenarios.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown flood scenario: ${id}`);
  return scenario;
}

export function assertBoundScenario(scenario: FloodScenario): FloodScenario {
  if (scenario.status !== 'VERIFIED' || !scenario.floodDepthAssetId) {
    throw new Error(`Flood scenario ${scenario.id} is not bound to verified depth data`);
  }
  return scenario;
}
