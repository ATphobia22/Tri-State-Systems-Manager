/**
 * 3D Tiles cache policy — byte-oriented budgets for the presentation plane.
 *
 * 3d-tiles-renderer 0.5.3 exposes LRUCache minBytesSize/maxBytesSize in addition
 * to tile-count limits. The renderer wires these thresholds into its cache
 * eviction path. They are eviction targets, not a hard process or GPU-VRAM
 * ceiling: in-use tiles may be retained, and GPU allocations are tracked
 * separately by renderer plugins.
 *
 * Presentation only — never authority for elevation or regulatory decisions.
 */
export const TSM_TILES_CACHE_POLICY = {
  maxCacheBytes: 512 * 1024 * 1024,
  minCacheBytes: 384 * 1024 * 1024,
  errorTargetBytes: 640 * 1024 * 1024,
  maxConcurrentRequests: 8,
  lruMaxSizeTiles: 8000,
  lruMinSizeTiles: 6000,
  units: 'bytes' as const,
  authority: 'PRESENTATION_ONLY' as const,
  note: 'LRU byte thresholds trigger cache eviction; they are not hard process or GPU-VRAM ceilings. MapLibre/WebGL remains primary map authority.',
} as const;

export type TsmTilesCachePolicy = typeof TSM_TILES_CACHE_POLICY;
