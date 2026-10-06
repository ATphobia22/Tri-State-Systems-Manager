# TSM 3D Tiles HLOD Streaming Pipeline

```text
4,121 derived building features
  -> deterministic LOD1 GLBs
  -> strict validation + SHA-256
  -> spatial HLOD quadtree in a shared ECEF-derived ENU frame
  -> strict validation + Cesium 3D Tiles validator
  -> deterministic leaf stitching
  -> Draco compression + glTF validation
  -> versioned artifact
  -> GitHub Pages publication + published hash retrieval
  -> Three.js / CesiumJS / Cesium for Unreal
```

The current dataset produces approximately 115 leaf content tiles under the default HLOD parameters. The count is derived, not a hard-coded invariant.

## HLOD correctness

The original HLOD partitioner used each building's independent local ENU coordinates. That is not a shared spatial reference. The production partitioner derives a common ENU frame from the ECEF centroid, transforms each building extent into that frame, and converts building transforms to root-relative transforms.

## Stitching

Each HLOD leaf is converted from multiple building GLBs into one root-frame GLB. Dry/flood-screening materials remain separate primitives when both occur in the same leaf.

## Draco

CI installs pinned `@gltf-transform/cli@4.5.1` and applies Draco compression. The final validator requires `KHR_draco_mesh_compression` in both `extensionsUsed` and `extensionsRequired`.

## Validation

`scripts/geospatial/validate-building-3d-tiles.py` checks:

- OGC 3D Tiles 1.1 structure and authority boundary;
- finite bounding volumes/transforms/geometric errors;
- safe local content URIs;
- duplicate and orphan content;
- GLB container and buffer integrity;
- Draco extension when required;
- manifest consistency;
- SHA-256 inventory;
- expected 4,121-building count.

CI additionally runs the Cesium 3D Tiles validator and glTF Transform validation.

## Artifact policy

Generated GLBs are never committed to Git. The final artifact is versioned:

```text
tsm-buildings-3d-tiles-v1-<git-sha>.zip
tsm-buildings-3d-tiles-v1-<git-sha>.zip.sha256
```

The Pages deployment publishes:

```text
/3d-tiles/buildings/tileset.json
```

and verifies the published `SHA256SUMS` by retrieving every listed object.

## Renderer support

- **Three.js:** existing `ThreeDTilesLayer`, self-hosted, no ion token.
- **CesiumJS:** `Cesium3DTilesLayer` loads a pinned CI-vendored CesiumJS build from `vendor/cesium/`, no ion token.
- **Unreal:** existing Cesium for Unreal plugin; see `docs/cesium-for-unreal-buildings.md`.
