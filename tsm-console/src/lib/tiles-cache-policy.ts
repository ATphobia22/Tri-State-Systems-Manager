/**
 * 3D Tiles cache policy — byte-oriented budgets for presentation plane.
 *
 * 3d-tiles-renderer exposes lruCache maxSize/minSize as tile counts.
 * TSM records an explicit byte budget so operators can size hosts without
 * inventing silent memory ceilings.
 *
 * Presentation only — never authority for elevation or regulatory decisions.
 */

export const TSM_TILES_CACHE_POLICY = {
  maxCacheBytes: 512 * 1024 * 1024,
  errorTargetBytes: 640 * 1024 * 1024,
  maxConcurrentRequests: 8,
  lruMaxSizeTiles: 8000,
  lruMinSizeTiles: 6000,
  units: 'bytes' as const,
  authority: 'PRESENTATION_ONLY' as const,
  note: 'Byte budgets are host guidance; MapLibre/WebGL remains primary map authority.',
} as const;

export type TsmTilesCachePolicy = typeof TSM_TILES_CACHE_POLICY;
