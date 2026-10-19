import { resolveTileSource, type GeospatialTileManifest } from './geospatial-tile-resolver';
import type { ResolvedTileSource } from './geospatial-tile-sources';
import {
  assertElevationEvidenceProduct,
  type ElevationAccuracyClass,
  type ElevationAuthorityClass,
  type ElevationEvidenceProduct,
  validateElevationEvidenceProduct,
} from './elevation-evidence-product';

export interface TerrainMetadata {
  readonly crs: string;
  readonly verticalDatum: string;
  readonly acquisitionDate: string | null;
  readonly qualityLevel: string | null;
  readonly sourceId: string;
  /** Optional epoch; required when CRS is time-dependent */
  readonly coordinateEpoch?: number | null;
  readonly accuracyClass?: ElevationAccuracyClass;
  readonly authorityClass?: ElevationAuthorityClass;
  readonly units?: 'meters' | 'feet';
  readonly contentSha256?: string | null;
}

export interface TerrainMetadataValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export function getTerrainSource(manifest: GeospatialTileManifest, now = new Date()): ResolvedTileSource {
  return resolveTileSource(manifest, 'usgs-3dep-terrain', now);
}

/** Map terrain metadata into the elevation evidence product and validate. */
export function terrainMetadataToEvidenceProduct(
  metadata: TerrainMetadata,
): Partial<ElevationEvidenceProduct> {
  return {
    horizontal_crs: metadata.crs,
    vertical_datum: metadata.verticalDatum,
    coordinate_epoch: metadata.coordinateEpoch ?? null,
    accuracy_class: metadata.accuracyClass ?? (metadata.qualityLevel ? 'DEM_1M' : 'UNKNOWN'),
    authority_class: metadata.authorityClass ?? 'OBSERVATION',
    source_id: metadata.sourceId,
    source_date: metadata.acquisitionDate,
    units: metadata.units ?? 'meters',
    content_sha256: metadata.contentSha256 ?? null,
  };
}

export function validateTerrainMetadata(metadata: TerrainMetadata): TerrainMetadataValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!metadata.crs.trim()) errors.push('Terrain CRS is required.');
  if (!metadata.verticalDatum.trim()) errors.push('Terrain vertical datum is required.');
  if (!metadata.sourceId.trim()) errors.push('Terrain source identifier is required.');

  const product = terrainMetadataToEvidenceProduct(metadata);
  const evidence = validateElevationEvidenceProduct(product);
  errors.push(...evidence.errors);
  warnings.push(...evidence.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/** Apply terrain only when elevation evidence is complete — no silent CRS/datum. */
export function assertTerrainEvidence(metadata: TerrainMetadata): ElevationEvidenceProduct {
  const product = terrainMetadataToEvidenceProduct(metadata);
  assertElevationEvidenceProduct(product);
  return product as ElevationEvidenceProduct;
}
