# Self-hosted CesiumJS and OGC 3D Tiles 1.1

## Runtime contract

The console exposes **/terrain-3d** as a dedicated CesiumJS terrain viewer and **/globe** as the multi-layer Cesium globe. Both load pinned Cesium assets from the same Pages origin. No Cesium ion token is required.

Terrain tileset path: `/3d-tiles/terrain-3dep/tileset.json` (relative to site base path).

## Visual availability versus evidence gates

**Visualization is not globally fail-closed.** A valid published tileset should render without live gauges or login. Missing assets show an explicit error; other console views remain usable.

**Scientific and regulatory claims remain evidence-gated.** 3DEP-derived mesh is not survey-grade vertical control and is not FEMA regulatory evidence.

## Local verification

```bash
node scripts/ci/validate-self-hosted-cesium.mjs
npm --prefix tsm-console run check:type
```
