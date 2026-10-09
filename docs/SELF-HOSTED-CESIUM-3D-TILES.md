# Self-hosted CesiumJS and OGC 3D Tiles 1.1

## Runtime contract

The console exposes **/terrain-3d** as a dedicated CesiumJS terrain viewer. It loads the pinned CesiumJS distribution from the same Pages origin under `/vendor/cesium/` and the generated USGS 3DEP-derived OGC 3D Tiles 1.1 terrain tileset from `/3d-tiles/terrain-3dep/tileset.json` (relative to the site base path). It does not require a Cesium ion token or a third-party Cesium script CDN.

The Pages workflow is responsible for materializing and validating these deployment assets:

1. Install pinned geospatial dependencies.
2. Build the Terrain-RGB MBTiles input and generate terrain GLB tile content.
3. Validate the OGC 3D Tiles terrain tileset and its content.
4. Vendor the pinned CesiumJS static runtime into `tsm-console/public/vendor/cesium/`.
5. Build the console, validate the copied `dist/3d-tiles` and `dist/vendor/cesium` assets, then upload the Pages artifact.
6. After publication, re-download the public tileset/runtime and verify expected files and hashes.

The deploy pipeline also produces a building 3D Tiles layer subject to its separate building-data and observed-height gates. A terrain-only visualization must not imply that the building dataset passed its own evidence gates.

## Browser route

- `/terrain-3d`: self-hosted CesiumJS viewer for the USGS 3DEP-derived terrain mesh.
- `/twin` and `/digital-twin-v2`: existing MapLibre twin surfaces.
- `/platform`: repository capabilities and package index.

The viewer uses the local base URL so it works at the GitHub Pages project subpath. It focuses the camera on the loaded tileset and exposes an explicit loading/ready/error state. Failure to load the 3D layer does not disable unrelated map, flood-simulation, or evidence views.

## Visual availability versus evidence gates

**Visualization is not globally fail-closed.** When a valid bundled or deployed terrain asset is present, the browser should render it without waiting for live gauges, API credentials, a login, or an unrelated provider. If the 3D asset cannot load, display the error and retain the other console surfaces. The build/deployment pipeline must still reject malformed or missing assets rather than publishing a broken tileset silently.

**Scientific and regulatory claims remain evidence-gated.** This mesh is a derived visualization from USGS 3DEP inputs. It is not survey-grade vertical control, does not itself establish NAVD88-to-ellipsoid conversion, and is not FEMA regulatory evidence or an engineering certification. Source metadata, vertical datum, coordinate transforms, processing versions, hashes, and limitations remain visible in the artifact manifests.

## Local verification

From the repository root:

```bash
node scripts/ci/validate-self-hosted-cesium.mjs
npm --prefix tsm-console run check:type
npm --prefix tsm-console run check:3d-tiles-tools
```

The production workflow performs terrain generation, OGC 3D Tiles validation, static asset integrity checks, and post-publication checks. The release contract does not depend on a separate smoke-test harness. A source-code check alone does not prove that GitHub Pages has deployed the latest artifacts; verify the production workflow and published URL separately.
