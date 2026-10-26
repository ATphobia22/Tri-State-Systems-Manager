# TSM optional meshoptimizer GLB codec

Status: experimental offline candidate for building geometry delivery. It does not replace the existing Draco release path before both browser and Cesium for Unreal decoder compatibility are independently tested.

## Format separation

- EXT_meshopt_compression encodes GLB buffers and requires a compatible decoder. KHR_mesh_quantization is a separate optional quantization extension. Meshopt encoding is not inherently lossless after vertex quantization.
- KHR_draco_mesh_compression remains the current release path. Actual byte savings are measured per dataset.
- PMTiles v3 is for vector and raster map tiles, not an arbitrary GLB/b3dm archive format.
- LAZ/COPC retain LiDAR point data and spatial access, not textured polygon-mesh presentation.

## Reproducible candidate pipeline

From the repository root, after locked tsm-console npm ci, invoke:

    node scripts/geospatial/compress-hlod-meshopt.mjs --input-dir /derived/stitched --output-dir /derived/meshopt-candidate

The script uses only the locally installed glTF Transform binary. It rejects nested input/output roots, symlinked source data, unsafe content URIs, duplicated references, and existing output. It retains all original uncompressed evidence assets, records source/output SHA-256 and measured ratios, preserves tile-level source OBJECTID arrays and marks output as INFORMATIONAL_ONLY.

The output directory contains only validated GLBs, tileset.json, manifest.json and SHA256SUMS. The receipt is written alongside that directory as an independent .meshopt-receipt.json so existing validators' exact-content contracts are unchanged.

## Release gates

1. Confirm glTF Transform CLI runs from local locked npm dependencies; test actual encoder, glTF validator and 3D Tiles validator.
2. Demonstrate decoding EXT_meshopt_compression on both the actual TSM browser Three.js loader and offline Cesium for Unreal 5.8. The source-level extension check alone is insufficient.
3. Validate decoded footprint geometry, holes, multipolygons, quantization error, LiDAR-based heights, feature IDs, tile transforms, and HLOD screen-space errors against immutable uncompressed originals.
4. Independently reconcile all 23,082 source OBJECTIDs; no codec repairs unavailable or invalid source buildings.
5. Publish verified compressed output as release/CI artifacts with hashes; chunk large archives for transport instead of committing generated binary inventories to main.

## Upstream sources

- https://gltf-transform.dev/cli
- https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md
- https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression
- https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
- https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
