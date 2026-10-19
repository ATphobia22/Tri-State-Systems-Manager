# Nanite plane integration (TSM) — 2026-10-19

## In-repo mesh inventory (main)

| Kind | Count / path |
|------|----------------|
| **GLB meshes** | **~4,628** under `tsm-console/public/3d-tiles/` (mostly `buildings-lidar-*` and `buildings/`) |
| **OBJ** | **0** |
| **Screening GeoJSON** | **22,815** features in `buildings-3d.json` (`height_m`) |
| **Pilot MeshletPack** | `data/buildings/meshlets/pilot-buildings-lidar-12450-3-3-0.json` |

Authority for building meshes: **DERIVED** only (`engineeringUse=false`). See `data/buildings/GLB-SUBSET-INVENTORY.md`.

## Architecture

```
MapLibre (Plane A)          WebGPU Nanite (Plane B)
  NFHL, gauges, parcels  →  shared camera bridge
  regulatory authority       depth pyramid (H-Z)
                             GLB → meshlets → frustum cull
                             SIMULATION_DEMO / DERIVED
```

### Modules (`tsm-console/src/lib/webgpu-nanite/`)

| File | Role |
|------|------|
| `webgpu-device.ts` | Device + portable limits |
| `depth-pyramid.ts` | GPU/CPU H-Z |
| `maplibre-webgpu-camera.ts` | MapLibre → ENU matrices |
| `glb-mesh-extract.ts` | GLB 2.0 POSITION/NORMAL (non-indexed OK) |
| `mesh-catalog.ts` | Curated public URLs for pilots |
| `meshlet-from-glb.ts` | URL/buffer → MeshletPack |
| `meshlet-import.ts` | Greedy 64/124 clustering + JSON I/O |
| `meshlet-cull.ts` | Frustum cull |
| `nanite-plane-runtime.ts` | Smoke: real GLB pilot → fallback cube |
| `NanitePlanePanel.tsx` | MapTwin probe |

### Enable

```bash
VITE_TSM_WEBGPU_NANITE=1
```

Smoke loads `/3d-tiles/buildings-lidar-12450/content/3/3/0.glb` (36 verts, 12 tris), meshlets it, culls it. Offline pack mirrors that under `data/buildings/meshlets/`.

## Batch meshlet bake and production upgrade path

The opt-in `Meshlet Batch Build` workflow batches every checked-in GLB under `tsm-console/public/3d-tiles/` and uploads:
- a deterministic per-input/per-output SHA-256 manifest;
- gzipped `MeshletPack` files preserving flattened triangle geometry and primitive-group metadata;
- a `failures.json` ledger for unsupported or malformed inputs.

Run it from GitHub Actions: [Meshlet Batch Build](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/workflows/meshlet-batch-build.yml). The job requires 4,628 discovered GLBs by default; it exits non-zero unless all discovered inputs are successfully built. Output is a temporary CI artifact, not committed bulk output. It is labelled `SIMULATION_DEMO` / `DERIVED` and is never terrain, survey, or regulatory evidence.

### Greedy algorithm (TSM importer)

See [GREEDY-MESHLET-ALGORITHM.md](./GREEDY-MESHLET-ALGORITHM.md) for the algorithm steps, complexity, validation contract, and distinction from meshoptimizer's production clusterizer.

1. Traverse the selected GLB scene and apply parent × child node transforms to each instance.
2. Concatenate each supported triangle primitive into a tile-local position/index buffer; record each primitive's material index and triangle span, but do not bake UVs, colors, textures or final materials.
3. Process triangles in their existing input order. A meshlet grows while adding the next triangle keeps the unique global-vertex set at or below 64 and the triangle count at or below 124.
4. Assign each meshlet a compact local vertex remap and local 8-bit triangle indices, then compute a bounding sphere over the meshlet's transformed vertices.
5. Validate local index ranges, vertex/triangle budgets, contiguous offsets, total triangle coverage, source hash, compressed-pack hash and content hash.

This is a deterministic, linear greedy pass over the triangle order, not an optimizer: it does not reorder triangles for spatial coherence, optimize vertex reuse globally, generate cone-aware bounds, or build a continuous LOD/DAG hierarchy. Production-quality clustering should use upstream meshoptimizer `meshopt_buildMeshlets`/`meshopt_buildMeshletsScan` plus the separately versioned METIS simplification/DAG pipeline. These algorithmic limits remain explicit in the manifest.

## Honest limits

- Not every GeoJSON feature has a GLB  
- Building meshes are **DERIVED**, not SFHA  
- No MapLibre-native GPU H-Z  
- No portable `atomic<u64>` visibility buffer  
