# Terrain GPU: Hi-Z, Transvoxel, Coverage, CRS, Cross-Device — 2026-10-23

## Policy

Technology informs people; it does not silently govern people. Human authority remains final.
Presentation pixels only — no evidence, model, or regulatory mutation from Hi-Z / Transvoxel.

## Implemented

| Piece | Path |
|-------|------|
| Hi-Z | `tsm-console/src/gpu/hierarchical-z.ts` + `.wgsl` |
| Transvoxel | `tsm-console/src/gpu/transvoxel-stitch.ts` |
| Coverage | `tsm-console/src/lib/terrain-coverage.ts` |
| CRS evidence | `tsm-console/src/lib/crs-vertical-datum-evidence.ts` |
| Cross-device | `tsm-console/src/lib/cross-device-validation.ts` |
| OpenSpec | `openspec/specs/terrain-gpu/spec.md` |
| Adoption | `docs/adoption/OSS-ADOPTION-COMPLETE-2026-10-23.md` |

## Validation

```bash
node --experimental-strip-types --test \
  tsm-console/tests/hierarchical-z-contract.test.mjs \
  tsm-console/tests/transvoxel-stitch-contract.test.mjs \
  tsm-console/tests/terrain-coverage-crs-device-contract.test.mjs
```

**Human authority remains final.**
