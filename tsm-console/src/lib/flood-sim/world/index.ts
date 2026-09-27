/**
 * world/index.ts — public surface of the flood-sim open-world scene kit.
 */
export { generateElevationGrid, buildTerrainMesh, resolveElevationGrid, DEM_SOURCES, TERRAIN_DATA_QUALITY } from './terrain';
export type { TerrainGenOptions, BuiltTerrain, DemSourceRef, ResolvedTerrainSource, SurveyedMeta, TerrainDataQuality, TerrainSourcePreference } from './terrain';
export { computeHillshade, applyHillshadeToColors } from './hillshade';
export type { HillshadeOptions } from './hillshade';
export {
  TerrainTileClient,
  LiveDataManager,
  fetchWithTimeout,
  fetchLiveTerrainGrid,
  mosaicToGrid,
  decodeTerrariumRgba,
  resolveTerrainWithFallback,
  TERRARIUM_BASE_URL,
  TILE_PX,
  lonToTileX,
  latToTileY,
  tileXToLon,
  tileYToLat,
} from './live-data';
export type {
  LiveStatus,
  SourceSnapshot,
  LiveDataSnapshot,
  TerrainTile,
  TerrainTileClientOptions,
  LiveTerrainFetchArgs,
  TerrainTier,
  ResolvedLiveTerrain,
  LiveDataManagerOptions,
  RgbaImage,
} from './live-data';
export { WaterSurface } from './water';
export type { WaterSurfaceOptions } from './water';
export { buildMarkers, resolveStationMarkers, ANCHOR_SITE } from './markers';
export type { BuiltMarkers, PlacedStation, UnplacedStation } from './markers';
export { createFloodRenderer, QUALITY_TIERS, QUALITY_TIER_ORDER, DEFAULT_SUN_DIRECTION } from './renderer';
export type { FloodRenderer, QualityTier, QualityTierSpec } from './renderer';
