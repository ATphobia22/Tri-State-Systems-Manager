export interface IngestionManifest {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly sourcePath: string;
  readonly sha256: string;
  readonly fileSizeBytes: number;
  readonly createdAt: string;
  readonly horizontalDatum?: string;
  readonly verticalDatum?: string;
  readonly epsg?: number;
  readonly engineeringUse: boolean;
  readonly regulatoryUse: boolean;
}
