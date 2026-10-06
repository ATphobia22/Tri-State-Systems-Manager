# TSM Cesium for Unreal — self-hosted building 3D Tiles

The native project already enables Cesium for Unreal in `tsm-native/TSMNative.uproject`. Linux CI does not build an Unreal Engine binary; this repository supplies the configured project contract and Windows/UE5.8 procedure.

## Production URL

```text
https://atphobia22.github.io/Tri-State-Systems-Manager/3d-tiles/buildings/tileset.json
```

Use **Cesium3DTileset → Source: From URL** and set **Url** to the address above. When the URL source is used, Cesium for Unreal ignores the ion asset ID/token.

1. Open the project with Unreal Engine 5.8.
2. Confirm Cesium for Unreal is enabled.
3. Add/configure a `CesiumGeoreference` actor.
4. Add a `Cesium3DTileset` actor.
5. Set Source to **From URL**.
6. Set Url to the production URL.
7. Place the georeference origin near Posey County before visual inspection.
8. Keep physics meshes disabled for the first visualization/performance pass unless collision is explicitly required.

## Local Windows verification

A local tileset may be loaded with a supported `file:///` URL, for example:

```text
file:///C:/path/to/3d-tiles/buildings/tileset.json
```

Use forward slashes in Windows file URLs.

## Release gate

Unreal smoke verification is green only after:

- TSM validator passes;
- Cesium 3D Tiles validator passes;
- every final GLB passes glTF validation;
- SHA-256 inventory passes;
- published Pages retrieval and SHA-256 verification pass;
- UE5.8 Windows smoke test loads the same published URL.

Linux CI intentionally does not claim an Unreal binary build.
