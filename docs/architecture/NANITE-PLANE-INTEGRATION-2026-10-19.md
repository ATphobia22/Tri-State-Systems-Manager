# Nanite plane integration (TSM) — 2026-10-19

## Architecture

```
MapLibre (Plane A)          WebGPU Nanite (Plane B)
  NFHL, gauges, parcels  →  shared camera bridge
  regulatory authority       depth pyramid (H-Z)
                             meshlet import + frustum cull
                             SIMULATION_DEMO only
```

### Modules (`tsm-console/src/lib/webgpu-nanite/`)

| File | Role |
|------|------|
| `webgpu-device.ts` | Adapter/device, portable limits, `VITE_TSM_WEBGPU_NANITE` |
| `depth-pyramid.ts` | GPU/CPU Hierarchical-Z mip chain |
| `maplibre-webgpu-camera.ts` | MapLibre view state → ENU view/projection |
| `meshlet-types.ts` | Pack contract (64/124 meshlets, CRS, authority) |
| `meshlet-import.ts` | Greedy cluster + JSON pack I/O + unit cube pilot |
| `meshlet-cull.ts` | Sphere frustum cull vs VP matrix |
| `nanite-plane-runtime.ts` | Smoke: device + pyramid + meshlets + cull |
| `NanitePlanePanel.tsx` | MapTwin UI probe button |

### Enable

```bash
VITE_TSM_WEBGPU_NANITE=1
```

## Meshlet import details

### From nanite-webgpu (production quality)

Upstream `ATphobia22/nanite-webgpu`:

1. `createMeshlets()` — **meshoptimizer** WASM (`meshopt_buildMeshlets`), max 64 verts / 124 tris, optional cone weight  
2. `simplifyMesh` + METIS — LOD **DAG** so coarse roots exist  
3. Export binary/JSON scene packs  

TSM does **not** vendor the full WASM stack in the console bundle. Offline:

```text
OBJ/glTF → nanite-webgpu preprocess → MeshletPack JSON → importMeshletPackJson()
```

### Portable path (in-repo)

`buildMeshletsGreedy()` clusters triangles sequentially under the same 64/124 budgets. Good for CI and small pilots; **not** continuous LOD. Warnings tell you to run the upstream bake for production.

### Evidence

Every `MeshletPack` carries:

- `authority` (default `SIMULATION_DEMO`)
- `horizontalCrs` / `verticalDatum`
- optional `contentSha256` for the evidence ledger

Never treat meshlets as SFHA or LOMA geometry.

## Integration flow

1. User opens Map Twin; panel shows if flag set  
2. **Probe WebGPU plane** → `runNanitePlaneSmoke`  
3. Camera from site center → matrices  
4. Unit cube meshleted + frustum culled  
5. Status JSON: limits, pyramid levels, meshlet visible/culled  

Next production step: bake one Posey building OBJ via nanite-webgpu and load with `importMeshletPackJson`.

## Honest limits

- No MapLibre-native GPU H-Z  
- No portable `atomic<u64>` for full visibility-buffer Nanite  
- Greedy meshlets ≠ UE5 continuous LOD  
- Chrome-first WebGPU; fail open to MapLibre  
