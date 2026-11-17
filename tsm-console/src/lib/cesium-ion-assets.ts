/**
 * Cesium ion asset registry — Tri-State open-world 4D twin
 * Update status after wait_for_asset COMPLETE.
 */

export const ION_CATALOG = {
  worldTerrain: 1,
  // User-provided ion asset: metadata, coverage, vertical reference and license not yet verified.
  terrainCandidate2426648: 2426648,
  osmBuildings: 96188,
  googlePhotorealistic: 2275207,
  bingAerial: 2,
  bingAerialLabels: 3,
  bingRoad: 4,
  sentinel2: 3954,
  googleSatelliteLabels: 3830183,
  azureAerial: 3891168,
  azureRoads: 3891169,
} as const;

/** Community uploads — created 2026-11-14; COMPLETE only after file upload + tiling */
export const ION_TSM = {
  poseyLod2Buildings: 6155963,
  posey3depTerrain: 6155965,
  poseyOrtho: 6155967,
} as const;

export const ION_LABELS = {
  tsmTriState: 551647,
  poseyCounty: 551648,
  openWorld4d: 551649,
} as const;

/** Default camera — Mount Vernon / Posey confluence area */
export const POSEY_HOME = {
  lon: -87.93,
  lat: 37.93,
  heightM: 2500,
} as const;

export type IonAssetStatus = "AWAITING_FILES" | "IN_PROGRESS" | "COMPLETE" | "ERROR";

/** Prefer local Posey tiles when COMPLETE; else OSM Buildings + World Terrain */
export function resolveBuildingsAssetId(poseyStatus: IonAssetStatus): number {
  return poseyStatus === "COMPLETE" ? ION_TSM.poseyLod2Buildings : ION_CATALOG.osmBuildings;
}

export function resolveTerrainAssetId(poseyStatus: IonAssetStatus): number {
  return poseyStatus === "COMPLETE" ? ION_TSM.posey3depTerrain : ION_CATALOG.worldTerrain;
}

/** Local-vs-cloud resolver; callers must supply verified, SHA-pinned evidence. */
export { chooseCesiumAsset } from './cesium-asset-evidence-guard';
export type { VerifiedIonReceipt, LocalAssetReceipt, SceneChoice, TsmIonAssetKey } from './cesium-asset-evidence-guard';

/** Optional *online* basemap presets. Never combine these opaque layers in the same scene. */
export const ION_IMAGERY_ASSETS = {
  googleLabels: ION_CATALOG.googleSatelliteLabels,
  azureAerial: ION_CATALOG.azureAerial,
  azureRoads: ION_CATALOG.azureRoads,
  sentinel2: ION_CATALOG.sentinel2,
} as const;

export type IonImageryPreset = 'usgs' | keyof typeof ION_IMAGERY_ASSETS;
export type TerrainPreviewSource = 'local' | 'world' | 'candidate2426648';
export type BuildingPreviewDetail = 'performance' | 'balanced' | 'sharp';

/** Runtime tile refinement only; does NOT generate new roof, facade or material geometry. */
export const BUILDING_SCREEN_SPACE_ERROR: Record<BuildingPreviewDetail, number> = {
  performance: 24,
  balanced: 16,
  sharp: 8,
};
