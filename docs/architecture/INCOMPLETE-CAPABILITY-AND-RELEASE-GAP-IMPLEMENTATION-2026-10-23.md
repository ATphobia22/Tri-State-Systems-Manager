# Incomplete capability + release-gap + WebGPU terrain — 2026-10-23

## Policy

Technology informs people; it does not silently govern people. Human authority remains final.
Presentation pixels only — no evidence, model, or regulatory mutation from WebGPU / C/S / adapters.

## Implemented (code-complete)

### Machine-readable registries

| Registry | Path | Status |
|----------|------|--------|
| Incomplete capabilities | `contracts/registries/tsm-incomplete-capability-registry-v1.json` | 10 capabilities; code items IMPLEMENTED |
| Release gaps | `contracts/registries/tsm-release-gap-registry-v1.json` | Code-closable CLOSED; operator items GATED |
| C/S resource manifest | `contracts/registries/tsm-cs-resource-manifest-v1.json` | plan_only; swap_enabled=false |
| CI validator | `scripts/ci/validate-capability-and-gap-registries.mjs` | Wired in `.github/workflows/ci.yml` |

### WebGPU terrain (presentation plane) — IMPLEMENTED

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

### Tiles cache byte policy — CLOSED

| Piece | Path |
|-------|------|
| Byte budgets | `tsm-console/src/lib/tiles-cache-policy.ts` (`maxCacheBytes`, `errorTargetBytes`) |
| Renderer wiring | `tsm-console/src/components/OpenWorld3DTilesRenderer.tsx` |

TilesRenderer still receives tile-count LRU; byte budgets are recorded for operators and future upstream maxBytes.

### C/S resource scheduler — IMPLEMENTED (plan-only)

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

### Other capabilities marked IMPLEMENTED

- `webgpu-ndvi-compute` — transient NDVI kernels; no evidence ledger writes
- `gpu-compute-culling` — CPU frustum plan generator (presentation)
- `cs-asset-swapping` — plan-only until variants registered
- `openusd-houdini-interchange`, `opencue-render-farm`, `rayshader-terrain-viz`, `4d-gaussian-splats` — boundary adapters ready

## Still open (operator / human only — not closable by repository code)

| Item | Registry status | Reason |
|------|-----------------|--------|
| Operator secrets | GATED_OPERATOR | Keycloak, production API origin, Databricks, Kafka, Ed25519 signing keys — never invented in repo |
| LOMA 26-05-2022A Layer-2 | GATED_OPERATOR | Human filing only; FEMA additional-info deadline 2026-12-21 |
| C/S swap enablement | remaining note on capability | Needs real registered tile variants (uri+sha256) from operators |
| Gage-zero NAVD88 conversion | GATED_OPERATOR | conversionPublished=false fail-closed until SIR/NWPS conflict resolved |
| FEMA LOMA external filing | GATED_OPERATOR | Prepare evidence only; no automatic filing |

## Validation (all green)

```bash
node scripts/ci/validate-capability-and-gap-registries.mjs
# → ok:true, webgpu_terrain:IMPLEMENTED, code_closable_closed:5

node --test \
  tsm-console/tests/webgpu-camera-bridge-contract.test.mjs \
  tsm-console/tests/frustum-culling-contract.test.mjs \
  tsm-console/tests/cs-resource-scheduler-contract.test.mjs \
  tsm-console/tests/webgpu-presentation-contract.test.mjs \
  tests/external-presentation-adapters.test.mjs
# → 14/14 pass
```

## Finish note

**All code-implementable items from the incomplete-capability registry, release-gap registry, and WebGPU terrain implementation are complete.**  
Nothing remains that the repository can close without operator secrets, human LOMA filing, or registered C/S tile variants.

**Human authority remains final.**
