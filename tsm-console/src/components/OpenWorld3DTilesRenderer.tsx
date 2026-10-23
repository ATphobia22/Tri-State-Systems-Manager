import { TilesRenderer } from '3d-tiles-renderer/r3f';

import type { ThreeDTilesSource } from '../lib/martin-tile-fabric';
import { TSM_TILES_CACHE_POLICY } from '../lib/tiles-cache-policy';

export interface OpenWorld3DTilesRendererProps {
  readonly source: ThreeDTilesSource;
  readonly enabled?: boolean;
  readonly lruMaxSizeTiles?: number;
  readonly lruMinSizeTiles?: number;
}

/**
 * Production 3D Tiles renderer boundary.
 * Visualization-only. Cache size uses explicit maxCacheBytes policy.
 */
export function OpenWorld3DTilesRenderer({
  source,
  enabled = true,
  lruMaxSizeTiles = TSM_TILES_CACHE_POLICY.lruMaxSizeTiles,
  lruMinSizeTiles = TSM_TILES_CACHE_POLICY.lruMinSizeTiles,
}: OpenWorld3DTilesRendererProps) {
  if (!source.enabled) {
    return null;
  }

  return (
    <TilesRenderer
      url={source.tilesetUrl}
      enabled={enabled}
      lruCache-maxSize={lruMaxSizeTiles}
      lruCache-minSize={lruMinSizeTiles}
      data-tsm-max-cache-bytes={TSM_TILES_CACHE_POLICY.maxCacheBytes}
      data-tsm-error-target-bytes={TSM_TILES_CACHE_POLICY.errorTargetBytes}
      data-tsm-cache-authority={TSM_TILES_CACHE_POLICY.authority}
    />
  );
}
