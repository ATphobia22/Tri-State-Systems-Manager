export interface ResultField {
  name: 'maximum_water_surface_elevation' | 'maximum_depth' | 'maximum_velocity' | 'arrival_time' | 'duration_above_threshold';
  units: string;
  storage: 'cell' | 'face' | 'cross_section';
  sourcePath: string;
  valueHashSha256: string;
}

export interface SolverResult {
  schemaVersion: 'solver-result-v1';
  execution: {
    engine: string;
    engineVersion: string;
    modelHashSha256: string;
    inputHashSha256: string;
    executionHashSha256: string;
    resultHashSha256: string;
    startedAt: string;
    completedAt: string;
    status: 'completed' | 'failed' | 'partial';
  };
  spatialReference: {
    horizontalCrs: string;
    verticalDatum: string;
    units: 'metric' | 'us-customary';
  };
  scenario: {
    name: string;
    probability?: number;
    returnPeriodYears?: number;
    boundaryConditionHashSha256: string;
  };
  domain: {
    meshHashSha256: string;
    cellCount: number;
    faceCount: number;
  };
  fields: ResultField[];
  provenance: {
    sourceUris: string[];
    retrievalTimestamp: string;
    derivation: string[];
  };
  validation: {
    convergence: 'pass' | 'fail' | 'unknown';
    volumeBalance: 'pass' | 'fail' | 'unknown';
    timestepStability: 'pass' | 'fail' | 'unknown';
    geometryIntegrity: 'pass' | 'fail' | 'unknown';
    humanReviewRequired: true;
  };
}
