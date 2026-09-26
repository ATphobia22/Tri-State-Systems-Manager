/**
 * world/index.ts — public surface of the flood-sim open-world scene kit.
 */
export { generateElevationGrid, buildTerrainMesh, DEM_SOURCES, TERRAIN_DATA_QUALITY } from './terrain';
export type { TerrainGenOptions, BuiltTerrain, DemSourceRef } from './terrain';
export { WaterSurface } from './water';
export type { WaterSurfaceOptions } from './water';
export { buildMarkers, resolveStationMarkers, ANCHOR_SITE } from './markers';
export type { BuiltMarkers, PlacedStation, UnplacedStation } from './markers';
export { createFloodRenderer, QUALITY_TIERS, QUALITY_TIER_ORDER, DEFAULT_SUN_DIRECTION } from './renderer';
export type { FloodRenderer, QualityTier, QualityTierSpec } from './renderer';
