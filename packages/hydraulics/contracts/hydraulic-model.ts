export type HydraulicEngine = 'hec-ras-2025' | 'hec-ras-6' | 'hec-ras-hdf5';

export interface HydraulicModelArtifact {
  schemaVersion: 'hydraulic-model-v1';
  artifactId: string;
  modelHashSha256: string;
  engine: HydraulicEngine;
  engineVersion: string;
  projectPath?: string;
  geometryPath?: string;
  terrainPath?: string;
  planPath?: string;
  horizontalCrs: string;
  verticalDatum: string;
  terrainHashSha256: string;
  geometryHashSha256: string;
  boundaryConditionHashSha256: string;
  humanReviewRequired: true;
}
