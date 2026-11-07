/**
 * Ingestion worker contracts — TSM fail-closed foundation.
 * Aligns with architecture/contracts/ingestion-pipeline-contract.json
 *
 * NOT complete HEC-RAS / MODFLOW / PDAL / OpenMI / UE runtimes.
 */

export type AuthorityClass =
  | 'AUTHORITATIVE'
  | 'DERIVED'
  | 'CONTEXT'
  | 'SIMULATION_DEMO';

export type AssetStatus =
  | 'RECEIVED'
  | 'QUARANTINED'
  | 'VALIDATED'
  | 'REJECTED'
  | 'PROMOTED'
  | 'ARCHIVED';

export type PipelineStage =
  | 'acquire'
  | 'quarantine'
  | 'validate'
  | 'normalize'
  | 'provenance'
  | 'promote'
  | 'derive'
  | 'publish';

export interface IngestionManifest {
  readonly assetType: string;
  readonly assetName: string;
  readonly sourcePath: string;
  readonly sourceId?: string;
  readonly sha256: string;
  readonly fileSizeBytes?: number;
  readonly horizontalDatum?: string;
  readonly verticalDatum?: string;
  readonly epsg?: number;
  readonly authorityClass: AuthorityClass;
  readonly engineeringUse: boolean;
  readonly regulatoryUse: boolean;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface AssetAdapter {
  readonly type: string;
  canProcess(path: string): boolean;
  buildManifest(path: string): Promise<IngestionManifest>;
  validate(manifest: IngestionManifest): Promise<ValidationResult>;
  ingest(manifest: IngestionManifest): Promise<{ assetId: string; runId: string }>;
}

/** HEC-RAS — evidence hashes only; not a solver. */
export interface HecRasEvidence {
  readonly projectHash: string;
  readonly geometryHash: string;
  readonly planHash: string;
  readonly hdfHash: string;
  readonly logHash: string;
  readonly solverVersion: string;
  readonly engineeringUse: false;
}

/** MODFLOW — evidence hashes only; not a solver. */
export interface ModflowEvidence {
  readonly namHash: string;
  readonly headHash: string;
  readonly budgetHash: string;
  readonly convergenceHash: string;
  readonly solverVersion: string;
  readonly engineeringUse: false;
}
