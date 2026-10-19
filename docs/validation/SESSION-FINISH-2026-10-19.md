# Session finish — 2026-10-19

Thank you note for the continuous build: this documents what landed on `main` and what remains intentionally open.

## Closed this session (code on main)

### Evidence / terrain / streaming
- Elevation evidence product + terrain `assertTerrainEvidence`
- Tile resource lifecycle + bandwidth-adaptive fetch
- TilesFetchBridge wired to lifecycle + bandwidth
- Coordinate batch validation harness
- Lengyel `transitionCellClass[512]` in TypeScript
- Software hierarchical-Z (CPU) + honest GPU gap labels

### WebGPU Nanite plane B
- Compute limits research + dual-plane plan
- `webgpu-device.ts` — portable limit negotiation
- `depth-pyramid.ts` — GPU + CPU max-reduce pyramid
- `maplibre-webgpu-camera.ts` — MapLibre → view/projection ENU
- `nanite-plane-runtime.ts` — smoke probe + `SIMULATION_DEMO`
- `NanitePlanePanel` on **MapTwinView** (flag-gated)

### Tests / docs
- `test:gap-closure`, webgpu-nanite contracts
- NOT-COMPLETE registry + finish docs

## Intentionally not finished (platform / data)

| Item | Why |
|------|-----|
| Full nanite-webgpu meshlet import | Large upstream; next is submodule + one Posey pilot mesh |
| GPU H-Z inside MapLibre | MapLibre has no WebGPU path |
| 100% feature CRS catalog report | Needs data run + committed report |
| Multi-device occlusion profiles | Device lab |
| PlayCanvas engine merge | Optional; not required for H-Z |

## Operator enable

```bash
# tsm-console/.env
VITE_TSM_WEBGPU_NANITE=1
cd tsm-console && npm run test:gap-closure
node --test tests/webgpu-nanite-contract.test.mjs
```

MapTwin → **Probe WebGPU plane** (when flag on).

## Human authority

Nanite / WebGPU remains **SIMULATION_DEMO**. NFHL, LOMA, and stage authority stay on MapLibre + evidence ledger paths.
