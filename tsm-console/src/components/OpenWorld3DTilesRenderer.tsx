import { TilesRenderer } from '3d-tiles-renderer/r3f';

import type { ThreeDTilesSource } from '../lib/martin-tile-fabric';

export interface OpenWorld3DTilesRendererProps {
  readonly source: ThreeDTilesSource;
  readonly enabled?: boolean;
}

/**
 * Production 3D Tiles renderer boundary.
 *
 * This component is visualization-only: source provenance and engineering
 * authority remain in TSM manifests and evidence services.
 */
export function OpenWorld3DTilesRenderer({
  source,
  enabled = true,
}: OpenWorld3DTilesRendererProps) {
  if (!source.enabled) {
    return null;
  }

  return (
    <TilesRenderer
      url={source.tilesetUrl}
      enabled={enabled}
      lruCache-maxSize={8000}
      lruCache-minSize={6000}
    />
  );
}
