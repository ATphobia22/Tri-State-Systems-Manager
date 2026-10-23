# Incomplete capability + release-gap + WebGPU terrain — 2026-10-23

## Policy

Technology informs people; it does not silently govern people. Human authority remains final.
Presentation pixels only — no evidence, model, or regulatory mutation from WebGPU / C/S / adapters.

## Implemented (code-complete)

### Machine-readable registries

| Registry | Path | Status |
|----------|------|--------|
| Incomplete capabilities | `contracts/registries/tsm-incomplete-capability-registry-v1.json` | Implementation status separated from verification; technical gates remain open |
| Release gaps | `contracts/registries/tsm-release-gap-registry-v1.json` | Individually evidenced items closed; technical and operator gates remain open |
| C/S resource manifest | `contracts/registries/tsm-cs-resource-manifest-v1.json` | plan_only; swap_enabled=false |
| CI validator | `scripts/ci/validate-capability-and-gap-registries.mjs` | Wired in `.github/workflows/ci.yml` |

### WebGPU terrain (presentation plane) — CODE PATH PRESENT; DEVICE ACCEPTANCE UNVERIFIED

| Piece | Path |
|-------|------|
| Source-bound raytracer | `tsm-console/src/gpu/open-world-raytracer.ts` (`getDevice`, `render`/`renderFrame`) |
| Explicit metric camera bridge | `tsm-console/src/gpu/webgpu-camera-bridge.ts` |
| React optional canvas host | `tsm-console/src/components/WebGpuTerrainCanvas.tsx` |
| Frustum culling plan | `tsm-console/src/gpu/frustum-culling.ts` (5000-node safety cap) |
| Bridge contract tests | `tsm-console/tests/webgpu-camera-bridge-contract.test.mjs` |
| Presentation contract tests | `tsm-console/tests/webgpu-presentation-contract.test.mjs` |
| Frustum contract tests | `tsm-console/tests/frustum-culling-contract.test.mjs` |

Contracts honored:

- No fabricated height textures.
- No hard-coded BFE / LAG / FFE / berm.
- MapLibre Web Mercator is **not** silently treated as metres.
- WebGPU remains optional; MapLibre WebGL stays the primary path.
- Caller must supply verified height/satellite GPUTextures with provenance + datum labels.

### Tiles cache byte policy — PARTIAL (GUIDANCE ONLY)

| Piece | Path |
|-------|------|
| Byte budgets | `tsm-console/src/lib/tiles-cache-policy.ts` (`maxCacheBytes`, `errorTargetBytes`) |
| Renderer wiring | `tsm-console/src/components/OpenWorld3DTilesRenderer.tsx` |

TilesRenderer still receives tile-count LRU. Byte budgets are **not enforced**: no byte accounting, byte-based eviction, hard ceiling, or backpressure is wired in. This gap remains open.

### C/S resource scheduler — PARTIAL (PLAN-ONLY)

| Piece | Path |
|-------|------|
| Manifest | `contracts/registries/tsm-cs-resource-manifest-v1.json` |
| Scheduler | `tsm-console/src/lib/cs-resource-scheduler.ts` |
| Contract tests | `tsm-console/tests/cs-resource-scheduler-contract.test.mjs` |

`swap_enabled` remains **false** until REGISTERED variants with `uri_template` + `sha256` exist. No silent network fetch of unregistered assets.

### External presentation / compute adapters — BOUNDARY_READY

| Piece | Path |
|-------|------|
| Fail-closed adapters | `integrations/adapters/external-presentation-adapters.mjs` |
| Contract tests | `tests/external-presentation-adapters.test.mjs` |

Adapters: OpenUSD/Houdini, OpenCue, rayshader, 4D Gaussian splats. All return `ok: false` until installed/configured. Authority PRESENTATION or COMPUTE only.

### Capability control plane

`webgpu-terrain-presentation` → **ENABLED** / **PRESENTATION** with human_review_required boundary note.

### Other capability boundaries

- `webgpu-ndvi-compute` — transient NDVI kernels; no evidence ledger writes
- `gpu-compute-culling` — **PARTIAL**; CPU frustum plan generator only, no GPU compute or H-Z
- `cs-asset-swapping` — **PARTIAL**; plan-only until variants registered
- OpenUSD/Houdini, OpenCue, rayshader, and 4D Gaussian splats — fail-closed adapter boundaries only; production integration is not verified

## Still open (technical and operator acceptance gates)

| Item | Registry status | Reason |
|------|-----------------|--------|
| Operator secrets | GATED_OPERATOR | Keycloak, production API origin, Databricks, Kafka, Ed25519 signing keys — never invented in repo |
| LOMA 26-05-2022A Layer-2 | GATED_OPERATOR | Human filing only; FEMA additional-info deadline 2026-12-21 |
| C/S swap enablement | PARTIAL | Needs real registered tile variants (uri+sha256) from operators |
| GPU Hierarchical-Z | OPEN | GPU compute depth pyramid, renderer integration, CPU-reference correctness, hardware evidence |
| Full Transvoxel transition coverage | OPEN | Runtime case coverage plus seam/topology fixtures |
| AOI terrain coverage | OPEN | Pinned source manifest, coverage/nodata report, recovery tests |
| CRS/datum/epoch/accuracy catalog | OPEN | Whole-catalog report with denominators, failures, and provenance |
| Cross-device GPU validation | OPEN | Representative browser/device correctness, performance, and memory matrix |
| Hard 3D Tiles cache byte budget | PARTIAL | Byte accounting and enforcement/eviction/backpressure required |
| Gage-zero NAVD88 conversion | GATED_OPERATOR | conversionPublished=false fail-closed until SIR/NWPS conflict resolved |
| FEMA LOMA external filing | GATED_OPERATOR | Prepare evidence only; no automatic filing |

## Validation commands (not evidence of current-main CI status)

```bash
node scripts/ci/validate-capability-and-gap-registries.mjs
# Expected to validate registry consistency and preserve open technical gates; run on the PR branch and confirm CI.

node --test \
  tsm-console/tests/webgpu-camera-bridge-contract.test.mjs \
  tsm-console/tests/frustum-culling-contract.test.mjs \
  tsm-console/tests/cs-resource-scheduler-contract.test.mjs \
  tsm-console/tests/webgpu-presentation-contract.test.mjs \
  tests/external-presentation-adapters.test.mjs
# Previously recorded result only; rerun on the current PR head to establish fresh evidence.
```

## Finish note

**The repository does not yet have evidence to declare all terrain/GPU release gates complete.** The renderer/camera bridge and some contract helpers exist, but GPU H-Z, complete Transvoxel acceptance, full AOI coverage, whole-catalog CRS/datum evidence, cross-device validation, hard cache enforcement, and real C/S swapping remain open or partial. Current-main CI status has not been established by this ledger.

**Human authority remains final.**
