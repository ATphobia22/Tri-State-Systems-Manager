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

## Production upgrade path

```text
GLB (repo) → optional nanite-webgpu meshoptimizer+METIS bake
           → MeshletPack JSON → importMeshletPackJson
```

Greedy in-console path is for CI and pilots; continuous LOD DAG stays upstream.

## Honest limits

- Not every GeoJSON feature has a GLB  
- Building meshes are **DERIVED**, not SFHA  
- No MapLibre-native GPU H-Z  
- No portable `atomic<u64>` visibility buffer  
