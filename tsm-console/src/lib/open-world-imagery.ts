import { resolveTileSource, type GeospatialTileManifest } from './geospatial-tile-resolver';
import type { ResolvedTileSource } from './geospatial-tile-sources';

export function getImagerySource(manifest: GeospatialTileManifest, now = new Date()): ResolvedTileSource {
  return resolveTileSource(manifest, 'indiana-current-imagery', now);
}

export interface ImageryMetadata {
  readonly crs: string;
  readonly acquisitionDate: string | null;
  readonly pixelResolutionMeters: number | null;
  readonly sourceId: string;
}

export function validateImageryMetadata(metadata: ImageryMetadata): readonly string[] {
  const errors: string[] = [];
  if (!metadata.crs.trim()) errors.push('Imagery CRS is required.');
  if (!metadata.sourceId.trim()) errors.push('Imagery source identifier is required.');
  if (metadata.pixelResolutionMeters !== null && metadata.pixelResolutionMeters <= 0) {
    errors.push('Imagery pixel resolution must be positive when supplied.');
  }
  return errors;
}
