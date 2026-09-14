import type { ResolvedTileSource } from '../lib/geospatial-tile-sources';

export interface OpenWorldTerrainLayerProps {
  readonly source: ResolvedTileSource;
  readonly exaggeration?: number;
}

/**
 * Declarative terrain-source contract for the Open-World Twin.
 * The actual map renderer owns the terrain source; this component exposes
 * source provenance and keeps visualization exaggeration separate from data.
 */
export function OpenWorldTerrainLayer({ source, exaggeration = 1 }: OpenWorldTerrainLayerProps) {
  if (exaggeration <= 0) throw new Error('Terrain exaggeration must be positive.');
  return (
    <div
      data-testid="open-world-terrain-layer"
      data-source-id={source.asset.id}
      data-source-state={source.state}
      data-source-crs={source.asset.crs}
      data-source-vertical-datum={source.asset.verticalDatum}
      data-exaggeration={exaggeration}
      aria-label={`Terrain source ${source.asset.dataset}; state ${source.state}`}
    />
  );
}
