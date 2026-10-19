# WebGPU compute limits & Nanite plane approach (2026-10-19)

## Spec minimum limits (portable baseline)

Every conformant adapter guarantees at least:

| Limit | Spec minimum |
|-------|----------------|
| `maxStorageBufferBindingSize` | **128 MiB** (134217728) |
| `maxBufferSize` | **256 MiB** |
| `maxComputeWorkgroupStorageSize` | **16384** bytes |
| `maxComputeInvocationsPerWorkgroup` | **256** |
| `maxComputeWorkgroupSizeX/Y` | **256** |
| `maxComputeWorkgroupSizeZ` | **64** |
| `maxComputeWorkgroupsPerDimension` | **65535** |
| `maxStorageBuffersPerShaderStage` | **8** (Chrome often exposes 10; request explicitly) |

**Portable design rule:** plan all dispatches and buffer layouts against the **spec minimum**, then optionally raise via `requiredLimits` after reading `adapter.limits`.

## Practical guidance for TSM

1. **Workgroup size = 64** for most compute (industry default for WebGPU).
2. **Depth pyramid / H-Z:** one storage texture or buffer per mip; cascade of compute passes; no need for 64-bit atomics.
3. **Nanite software raster / visibility buffer:** full UE5 path wants **64-bit atomic min** on depth+payload. WGSL still lacks general `u64`; proposal `atomic_vec2u_min_max` exists for Nanite-like use but is **not baseline**. Until widely available, use nanite-webgpu’s **32-bit packed** approach (u16 depth + octahedral normals) and accept precision limits — label as `SIMULATION_DEMO`.
4. **Meshlet instance lists:** budget against **128 MiB** storage binding; chunk by region if Posey-scale instance counts grow.
5. **Chrome vs Safari:** feature-detect `navigator.gpu`; Safari/iOS support lags for advanced features — fail open to MapLibre + WebGL occlusion.
6. **No total VRAM query** — never assume free memory; use `TileResourceLifecycle` + bandwidth adaptive on CPU side.

## Best approach for TSM (decision)

| Plane | Stack | Role |
|-------|--------|------|
| **A — Regulatory map** | MapLibre WebGL2 | NFHL, gages, parcels — **unchanged** |
| **B — Dense geometry** | WebGPU + ported nanite-webgpu passes | Meshlets, GPU depth pyramid H-Z, optional impostors |
| **C — Optional engine** | PlayCanvas (`ATphobia22/engine`) | Only if full scene graph needed beyond Three+Nanite |

**Do not** embed GPU H-Z inside MapLibre. **Do** share camera and evidence labels across planes.

### Implementation order
1. Device bootstrap + limit snapshot (`webgpu-device.ts`)
2. Depth pyramid compute (closes GPU H-Z for plane B)
3. Submodule / sparse reference to `nanite-webgpu` for meshlet preprocess offline
4. Feature flag `VITE_TSM_WEBGPU_NANITE`
5. Pilot one Posey building meshlet pack with ElevationEvidenceProduct

### Explicit non-goals (this pass)
- Replacing MapLibre
- Claiming software-raster Nanite as survey-grade
- Requiring WebGPU for river/NFHL console
