import {
  classifySourceState,
  resolveTileAsset,
  type GeospatialTileAsset,
  type ResolvedTileSource,
} from './geospatial-tile-sources';

export interface GeospatialTileManifest {
  readonly schemaVersion: '1.0.0';
  readonly generatedAt: string;
  readonly scope: string;
  readonly assets: readonly GeospatialTileAsset[];
}

export function getTileSourceManifest(manifest: GeospatialTileManifest): readonly GeospatialTileAsset[] {
  return manifest.assets;
}

export function resolveTileSource(
  manifest: GeospatialTileManifest,
  layerId: string,
  now = new Date(),
): ResolvedTileSource {
  const asset = manifest.assets.find(({ id }) => id === layerId);
  if (!asset) {
    throw new Error(`Unknown geospatial layer: ${layerId}`);
  }
  return resolveTileAsset(asset, now);
}

export function resolveOpenWorldSources(
  manifest: GeospatialTileManifest,
  layerIds: readonly string[],
  now = new Date(),
): readonly ResolvedTileSource[] {
  return layerIds.map((layerId) => resolveTileSource(manifest, layerId, now));
}

export function getSourceState(asset: GeospatialTileAsset, now = new Date()) {
  return classifySourceState(asset, now);
}
