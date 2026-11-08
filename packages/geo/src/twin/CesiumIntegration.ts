/**
 * CesiumJS integration helpers for TSM.
 * Repo: https://github.com/CesiumGS/cesium
 * Status: PARTIAL — use when Cesium is loaded; MapLibre remains primary 2D.
 */

export const CESIUM_AUTHORITY = "PRESENTATION" as const;

export type CesiumIonConfig = {
  ionAccessToken?: string;
  terrainAssetId?: number;
  /** Self-hosted terrain or 3D Tiles URL */
  tilesetUrl?: string;
};

export type CesiumViewerOptions = CesiumIonConfig & {
  containerId: string;
  longitude: number;
  latitude: number;
  heightM?: number;
};

/** Build a minimal viewer config object (caller constructs Cesium.Viewer). */
export function buildBonebankCesiumConfig(
  partial: Partial<CesiumViewerOptions> = {}
): CesiumViewerOptions {
  return {
    containerId: partial.containerId ?? "tsm-cesium-root",
    longitude: partial.longitude ?? -88.0051,
    latitude: partial.latitude ?? 37.84589,
    heightM: partial.heightM ?? 4000,
    ionAccessToken: partial.ionAccessToken ?? (typeof process !== "undefined" ? process.env?.CESIUM_ION_TOKEN : undefined),
    tilesetUrl: partial.tilesetUrl,
    terrainAssetId: partial.terrainAssetId,
  };
}

export function cesiumStatus(): {
  status: "PARTIAL";
  authority: typeof CESIUM_AUTHORITY;
  repo: string;
  next: string[];
} {
  return {
    status: "PARTIAL",
    authority: CESIUM_AUTHORITY,
    repo: "https://github.com/CesiumGS/cesium",
    next: [
      "Load Cesium from npm or CDN in the twin route",
      "Point tilesetUrl at self-hosted 3D Tiles or Ion asset",
      "Keep SIMULATION_DEMO banners on hydraulic overlays",
    ],
  };
}
