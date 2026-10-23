import { TilesRenderer } from '3d-tiles-renderer/r3f';

import type { ThreeDTilesSource } from '../lib/martin-tile-fabric';
import { TSM_TILES_CACHE_POLICY } from '../lib/tiles-cache-policy';

export interface OpenWorld3DTilesRendererProps {
  readonly source: ThreeDTilesSource;
  readonly enabled?: boolean;
  readonly lruMaxSizeTiles?: number;
  readonly lruMinSizeTiles?: number;
  readonly lruMaxBytes?: number;
  readonly lruMinBytes?: number;
}

/**
 * Production 3D Tiles renderer boundary.
 * Visualization-only. Both tile-count and byte thresholds are configured on
 * the renderer's LRU cache. Byte limits are eviction thresholds, not a hard
 * process/GPU memory cap; active tiles can remain resident over budget.
 */
export function OpenWorld3DTilesRenderer({
  source,
  enabled = true,
  lruMaxSizeTiles = TSM_TILES_CACHE_POLICY.lruMaxSizeTiles,
  lruMinSizeTiles = TSM_TILES_CACHE_POLICY.lruMinSizeTiles,
  lruMaxBytes = TSM_TILES_CACHE_POLICY.maxCacheBytes,
  lruMinBytes = TSM_TILES_CACHE_POLICY.minCacheBytes,
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
      lruCache-maxBytesSize={lruMaxBytes}
      lruCache-minBytesSize={lruMinBytes}
      data-tsm-max-cache-bytes={lruMaxBytes}
      data-tsm-min-cache-bytes={lruMinBytes}
      data-tsm-error-target-bytes={TSM_TILES_CACHE_POLICY.errorTargetBytes}
      data-tsm-cache-authority={TSM_TILES_CACHE_POLICY.authority}
    />
  );
}
