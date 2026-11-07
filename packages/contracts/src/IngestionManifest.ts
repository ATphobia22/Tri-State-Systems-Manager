/**
 * Ingestion manifest + asset-adapter contracts.
 *
 * An adapter turns source bytes (or a source path) into an
 * {@link IngestionManifest} that records exactly what was ingested, its
 * SHA-256 checksum, and how many features it carried. Adapters never invent
 * measurements: a manifest only reports values observed in the input.
 *
 * Resilience rule (repo-wide, user directive 2026-10-19): adapter validation
 * failures return an UNAVAILABLE / REJECTED {@link IngestionResult} with a
 * reason, never throw-by-default. The single exception is missing required
 * configuration (e.g. a required credential / DSN env var), which must fail
 * loudly at construction so a misconfigured deployment cannot silently
 * ingest nothing.
 */

export type IngestionAssetKind =
  | 'geojson'
  | 'geopackage'
  | 'shapefile'
  | 'csv'
  | 'unknown';

export type IngestionOutcome = 'INGESTED' | 'UNAVAILABLE' | 'REJECTED';

export interface IngestionManifest {
  /** Deterministic run id derived from the input checksum. */
  readonly runId: string;
  /** Source system id, e.g. a government_sources.source_id. */
  readonly sourceId: string;
  /** Where the bytes came from (URI or local path). */
  readonly sourceUri: string;
  readonly datasetVersion?: string;
  readonly assetKind: IngestionAssetKind;
  /** Lowercase hex SHA-256 of the exact input bytes. */
  readonly checksumSha256: string;
  readonly byteSize: number;
  /** Feature/record count observed in the input, when the format carries one. */
  readonly featureCount?: number;
  readonly status: IngestionOutcome;
  readonly retrievedAt: string;
  readonly adapterName: string;
  /** Target table/layer the adapter wrote to, when applicable. */
  readonly targetLayer?: string;
}

export interface IngestionInput {
  readonly bytes: Uint8Array;
  readonly sourceId: string;
  readonly sourceUri: string;
  readonly datasetVersion?: string;
  readonly assetKind: IngestionAssetKind;
  /** Target table/layer for adapters that write to a database. */
  readonly targetLayer?: string;
}

export interface IngestionResult {
  readonly status: IngestionOutcome;
  readonly manifest?: IngestionManifest;
  /**
   * Human-readable reason. Always present unless status is INGESTED;
   * UNAVAILABLE means the input could not be obtained or the tool was
   * missing, REJECTED means the input failed validation.
   */
  readonly reason?: string;
}

export interface AssetAdapter {
  readonly name: string;
  readonly supportedKinds: readonly IngestionAssetKind[];
  ingest(input: IngestionInput): Promise<IngestionResult>;
}
