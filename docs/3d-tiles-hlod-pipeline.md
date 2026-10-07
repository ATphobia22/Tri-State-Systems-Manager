# TSM 3D Tiles HLOD Production Pipeline

The production path is:

```text
4,121 derived building features
  -> deterministic LOD1 GLBs
  -> strict 3D Tiles/GLB/SHA-256 validation
  -> shared ECEF-derived ENU HLOD quadtree
  -> deterministic leaf stitching
  -> pinned Draco compression
  -> Cesium 3D Tiles + glTF validation
  -> versioned artifact
  -> GitHub Pages publication
  -> Three.js / CesiumJS / Cesium for Unreal
```

## Current validated geometry

The current full-data CI run produced:

- **4,121** LOD1 building GLBs;
- **4,336** HLOD hierarchy nodes;
- **161** spatial leaf content tiles;
- **161/161** stitched leaf GLBs successfully Draco-compressed;
- final TSM validator: pass;
- Cesium 3D Tiles validator: pass;
- glTF Transform validation: pass.

The leaf count is **derived**, not an invariant. The earlier ~115 estimate is intentionally not treated as a contract because the corrected shared-coordinate partition can legitimately change it.

## HLOD spatial correctness

The HLOD builder derives a common ENU frame from the ECEF centroid of the building dataset. Building bounding volumes are transformed into that frame for partitioning, and each building child transform is converted to a transform relative to the HLOD root.

This avoids partitioning on independent per-building ENU coordinates, which would collapse unrelated buildings into an invalid common spatial space.

## Stitching and Draco

Each HLOD leaf is transformed into the shared root frame and stitched into one GLB. Source normals and flood-screening materials are retained as separate primitives.

CI uses pinned `@gltf-transform/cli@4.5.1` for Draco compression. Final content URIs point only to the Draco outputs; intermediate uncompressed stitched GLBs are not published.

## Validation contract

`scripts/geospatial/validate-building-3d-tiles.py` checks:

- 3D Tiles 1.1 asset version;
- TSM derived-data authority boundary;
- finite bounding volumes and transforms;
- safe local GLB URIs;
- duplicate and orphan GLBs;
- GLB container and buffer bounds;
- mandatory Draco extension when requested;
- expected 23,082-authoritative-IGIO-building provenance count;
- SHA-256 inventory.

CI additionally runs the pinned Cesium 3D Tiles validator and glTF Transform validator.

## Artifact policy

Generated GLBs are build artifacts and are never committed to Git.

The release artifact is:

```text
tsm-buildings-3d-tiles-v1-<git-sha>.zip
tsm-buildings-3d-tiles-v1-<git-sha>.zip.sha256
```

with payload rooted at:

```text
3d-tiles/buildings/
```

## Renderers

- **Three.js:** existing self-hosted 3D Tiles renderer.
- **CesiumJS:** `CesiumTilesLayer.tsx` loads a pinned CI-vendored CesiumJS runtime from `vendor/cesium/`; no ion token.
- **Cesium for Unreal:** existing plugin in `tsm-native/TSMNative.uproject`; Windows/UE5.8 smoke verification remains an explicit release gate.
