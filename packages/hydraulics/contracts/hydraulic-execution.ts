import type { HydraulicEngine, HydraulicModelArtifact } from './hydraulic-model';

export type HydraulicExecutionStatus = 'completed' | 'failed' | 'partial';

export interface HydraulicExecutionReceipt {
  schemaVersion: 'hydraulic-execution-v1';
  executionId: string;
  engine: HydraulicEngine;
  engineVersion: string;
  model: Pick<HydraulicModelArtifact, 'artifactId' | 'modelHashSha256'>;
  inputHashSha256: string;
  commandHashSha256?: string;
  resultArtifactUri?: string;
  resultHashSha256?: string;
  startedAt: string;
  completedAt: string;
  exitCode?: number;
  status: HydraulicExecutionStatus;
  messages: string[];
  humanReviewRequired: true;
}
