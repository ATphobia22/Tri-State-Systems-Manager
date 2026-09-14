import { resolveTileSource, type GeospatialTileManifest } from './geospatial-tile-resolver';
import type { ResolvedTileSource } from './geospatial-tile-sources';

export interface TerrainMetadata {
  readonly crs: string;
  readonly verticalDatum: string;
  readonly acquisitionDate: string | null;
  readonly qualityLevel: string | null;
  readonly sourceId: string;
}

export interface TerrainMetadataValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function getTerrainSource(manifest: GeospatialTileManifest, now = new Date()): ResolvedTileSource {
  return resolveTileSource(manifest, 'usgs-3dep-terrain', now);
}

export function validateTerrainMetadata(metadata: TerrainMetadata): TerrainMetadataValidation {
  const errors: string[] = [];
  if (!metadata.crs.trim()) errors.push('Terrain CRS is required.');
  if (!metadata.verticalDatum.trim()) errors.push('Terrain vertical datum is required.');
  if (!metadata.sourceId.trim()) errors.push('Terrain source identifier is required.');
  return { valid: errors.length === 0, errors };
}
