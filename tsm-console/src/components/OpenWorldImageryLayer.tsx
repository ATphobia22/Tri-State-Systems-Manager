import type { ResolvedTileSource } from '../lib/geospatial-tile-sources';

export interface OpenWorldImageryLayerProps {
  readonly source: ResolvedTileSource;
}

/** Declarative imagery-source contract; MapLibre owns raster rendering. */
export function OpenWorldImageryLayer({ source }: OpenWorldImageryLayerProps) {
  return (
    <div
      data-testid="open-world-imagery-layer"
      data-source-id={source.asset.id}
      data-source-state={source.state}
      data-source-crs={source.asset.crs}
      aria-label={`Imagery source ${source.asset.dataset}; state ${source.state}`}
    />
  );
}
