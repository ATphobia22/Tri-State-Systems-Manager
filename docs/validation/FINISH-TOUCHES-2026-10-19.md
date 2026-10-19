# Finishing touches — 2026-10-19

## Committed on main

### Evidence & terrain
- `elevation-evidence-product.ts` — CRS / vertical datum / epoch / accuracy / authority
- `open-world-terrain.ts` — `assertTerrainEvidence` / product mapping
- `coordinate-validation-batch.ts` — catalog coverage harness

### Streaming
- `tile-resource-lifecycle.ts` — status machine + non-synthetic guard
- `bandwidth-adaptive-fetch.ts` — throughput → concurrency / degrade
- `tiles-fetch-bridge.ts` — **wired** lifecycle + bandwidth into each frame

### Transvoxel / culling
- `transvoxel-lengyel-classes.ts` — full Lengyel `transitionCellClass[512]` (56 classes)
- `transvoxel-stitcher.ts` — uses Lengyel classification
- `hierarchical-z-software.ts` — CPU pyramid; GPU H-Z still blocked

### Honesty
- `docs/validation/NOT-COMPLETE-REGISTRY-2026-10-18.md` updated
- `README.md` / `ROADMAP.md` gap tables

### Tests / scripts
- `tests/gap-closure-contracts.test.mjs`
- `tests/elevation-evidence-and-lifecycle.test.mjs`
- `npm run test:gap-closure` in `tsm-console/package.json`

## Still not claimed complete

| Item | Why |
|------|-----|
| GPU Hierarchical-Z | MapLibre has no WebGPU compute path |
| County-scale Transvoxel mesh | Class tables done; full mesh emission at AOI scale is runtime/data |
| 100% feature CRS/datum | Needs batch run on full catalog + committed report |
| Multi-device occlusion profiles | Needs device lab measurements |

## Verify locally

```bash
cd tsm-console
npm run test:gap-closure
python3 ../scripts/geospatial/transvoxel_tables.py
```
