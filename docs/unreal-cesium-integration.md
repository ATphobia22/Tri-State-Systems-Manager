# TSM Cesium for Unreal — self-hosted building 3D Tiles

The existing `tsm-native/TSMNative.uproject` enables Cesium for Unreal. Linux CI does not build an Unreal Engine binary; this document is the Windows/UE5.8 configuration contract.

## Published tileset

Use the GitHub Pages path:

`/3d-tiles/buildings/tileset.json`

The full production origin is the repository's GitHub Pages origin. Configure the actor with **Source = From URL** and do not configure a Cesium ion asset ID or token.

## UE5.8 procedure

1. Open `tsm-native/TSMNative.uproject` with Unreal Engine 5.8.
2. Add or use a `CesiumGeoreference` actor.
3. Add a `Cesium3DTileset` actor.
4. Set **Source** to **From URL**.
5. Set **Url** to the published TSM building tileset.
6. Place the georeference origin near Posey County before visual inspection.
7. Keep physics meshes disabled for the first visualization/performance pass unless collision is explicitly required.

Cesium for Unreal's URL source is designed for self-hosted 3D Tiles and ignores ion credentials when a URL is supplied.

## Local Windows smoke test

The generated artifact can be served locally or loaded with Cesium for Unreal's supported `file:///` form. Use forward slashes in Windows file URLs.

The release gate requires:

- TSM building validator passes;
- Cesium 3D Tiles validator passes;
- final GLBs pass glTF validation;
- SHA-256 manifest passes;
- published Pages retrieval passes;
- the same published tileset loads in UE5.8 on Windows.

The geometry is visualization/screening data, not survey-grade engineering geometry or a regulatory flood determination.
