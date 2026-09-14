import { resolveTileSource, type GeospatialTileManifest } from './geospatial-tile-resolver';
import type { ResolvedTileSource } from './geospatial-tile-sources';

export function getHistoricalPointTownshipLayers(
  manifest: GeospatialTileManifest,
  now = new Date(),
): readonly ResolvedTileSource[] {
  const source = resolveTileSource(manifest, 'point-township-historical', now);
  if (source.state !== 'HISTORICAL') {
    throw new Error('Point Township historical source must remain classified as HISTORICAL.');
  }
  return [source];
}
