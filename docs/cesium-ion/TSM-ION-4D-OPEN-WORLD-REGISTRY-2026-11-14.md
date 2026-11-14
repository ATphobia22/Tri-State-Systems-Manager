# Cesium ion — TSM 4D Open-World Registry (2026-11-14)

## Catalog assets (always available)

| Asset ID | Name | Type | Role |
|----------|------|------|------|
| **1** | Cesium World Terrain | TERRAIN | Global ground |
| **96188** | Cesium OSM Buildings | 3DTILES | World cityscape proxy until Posey LOD2 COMPLETE |
| **2275207** | Google Photorealistic 3D Tiles | 3DTILES | Optional realism (ToS) |
| **2 / 3 / 4** | Bing Aerial / Labels / Road | IMAGERY | Basemap options |
| **3954** | Sentinel-2 | IMAGERY | Regional ortho |

## TSM community assets (created 2026-11-14 — upload files in ion importer)

| Asset ID | Name | Type | Source | Status |
|----------|------|------|--------|--------|
| **6155963** | TSM Posey LOD2 Buildings | 3DTILES | CITYGML | AWAITING_FILES |
| **6155965** | TSM Posey 3DEP Terrain | TERRAIN | RASTER_TERRAIN | AWAITING_FILES |
| **6155967** | TSM Posey Ortho Imagery | IMAGERY | RASTER_IMAGERY | AWAITING_FILES |

## Labels

| ID | Name | Color |
|----|------|-------|
| 551647 | TSM-Tri-State | #1e88e5 |
| 551648 | Posey-County | #43a047 |
| 551649 | 4D-Open-World | #8e24aa |

## Viewer wiring (CesiumJS)

```js
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain(), // asset 1 until 6155965 COMPLETE
  baseLayer: Cesium.ImageryLayer.fromWorldImagery(),
});

// World buildings now; swap to Posey LOD2 when COMPLETE
const buildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
viewer.scene.primitives.add(buildings);

// After tiling:
// viewer.scene.primitives.add(await Cesium.Cesium3DTileset.fromIonAssetId(6155963));
// viewer.terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(6155965);
// viewer.imageryLayers.addImageryProvider(
//   await Cesium.IonImageryProvider.fromAssetId(6155967)
// );

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(-87.93, 37.93, 2500),
}); // Mount Vernon / Posey approx
```

## 4D layers (not ion-tiled — app overlays)

- Live stage: `@tsm/hydrology` resilient client  
- Historical floods / forecast: time-keyed GeoJSON / WMS  
- NFHL / LOMA: evidence plane  

## Upload checklist

1. Open each importer card; select CityGML / DEM GeoTIFF / ortho GeoTIFF  
2. `wait_for_asset` until COMPLETE  
3. Assign labels TSM-Tri-State + Posey-County + 4D-Open-World  
4. Set `VITE_CESIUM_ION_TOKEN` (assets:read) in deploy env  
5. Point `/twin` Cesium path at asset ids above  

## Non-claims

Ion tiles are visualization. FIRM / BAFL / survey remain regulatory authority.

## Offline and provenance decision boundary (2026-11-14)

The Open Source Software page at ion.cesium.com is a **third-party notice**, not a prescription to add the entire Cesium ion server dependency tree to TSM. The existing MapLibre/Three.js web Atlas and native Unreal rendering are retained. Do not add AWS, Azure, Bentley, React or authentication packages solely because ion lists them; adopt selectively with license, security, runtime and redundancy review.

TSM has a source-evidence resolver in `tsm-console/src/lib/cesium-asset-evidence-guard.ts`. The resolver is **not a replacement for a filesystem hash verifier or a live ion API check**: its inputs must originate from verified manifests and completed source/tiling receipts.

- For network-disabled native/offline use, select only a packaged, SHA-pinned local tileset. No ion fallback, CDNs, localhost or server requirement is permitted.
- For online Pages, permit Cesium ion only when a public-scoped ion token is configured. If Posey user assets lack completed tiling and provenance receipts, keep them `AWAITING_FILES`, using world assets for contextual imagery/geometry only.
- Do not treat the built-in global imagery/terrain IDs as always available offline or as regulatory/survey evidence.
- Reject local traversal/absolute URLs, unreviewed licenses, and missing SHA256 evidence. Independently verify the staged local content against that SHA before use.
- Do not treat Google Photorealistic 3D Tiles as distributable offline assets without a separately verified license allowing that distribution.

The `tests/cesium-asset-evidence-guard.test.mjs` regression suite checks these boundaries. A full headed Unreal Windows Shipping test and offline data staging remain separate release gates.
