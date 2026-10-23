# Terrain GPU: Hi-Z, Transvoxel, Coverage, CRS, Cross-Device — 2026-10-23

## Policy

Technology informs people; it does not silently govern people. Human authority remains final.  
Presentation pixels only — no evidence, model, or regulatory mutation from Hi-Z / Transvoxel.

## 1. GPU Hierarchical-Z

| Piece | Path |
|-------|------|
| WGSL compute | `tsm-console/src/gpu/hierarchical-z.wgsl` (+ inline `HIZ_DOWNSAMPLE_WGSL`) |
| CPU reference + GPU session | `tsm-console/src/gpu/hierarchical-z.ts` |
| Context-loss | Session marks `lost`; refuses further GPU work; integration falls back to CPU |
| Correctness tests | `tsm-console/tests/hierarchical-z-contract.test.mjs` |
| Perf measurement | `measureHiZBuildCpu` / `integrateHiZWithRenderer` → `HiZPerfMeasurement` |

Max-filter 2×2 downsample matches WGSL. Occlusion assist is presentation-only.

## 2. Transvoxel terrain stitching

| Piece | Path |
|-------|------|
| LOD edges + seam checks | `tsm-console/src/gpu/transvoxel-stitch.ts` |
| Representative AOI run | `runRepresentativeAreaStitch` (Bonebank-style lattice) |
| Tests | `tsm-console/tests/transvoxel-stitch-contract.test.mjs` |

Seam residual measured in metres; analytic continuous surface used for geometry tests. Production heights remain caller-supplied — no fabricated DEM.

## 3. Terrain and asset coverage

| Piece | Path |
|-------|------|
| AOI manifest | `contracts/registries/tsm-terrain-aoi-coverage-manifest-v1.json` |
| Coverage + recovery | `tsm-console/src/lib/terrain-coverage.ts` |
| Tests | `tsm-console/tests/terrain-coverage-crs-device-contract.test.mjs` |

Unknown cells = nodata (fail closed). Provider recovery never invents endpoints; fails closed when no PUBLISHED provider exists.

## 4. CRS and vertical-datum evidence

| Piece | Path |
|-------|------|
| Catalog evaluator | `tsm-console/src/lib/crs-vertical-datum-evidence.ts` |
| CLI report | `scripts/geospatial/crs-vertical-datum-evidence-report.mjs` |
| JSON + MD outputs | `data/geospatial/crs-vertical-datum-evidence-report-v1.json`, `docs/gpu/CRS-VERTICAL-DATUM-EVIDENCE-2026-10-23.md` |

Missing CRS/datum → `MISSING_CRITICAL`. NGVD29↔NAVD88 not auto-converted.

## 5. Cross-device validation

| Piece | Path |
|-------|------|
| Matrix + harness | `tsm-console/src/lib/cross-device-validation.ts` |
| Tests | same coverage test file |

Desktop discrete/integrated + iOS/Android class profiles. **Live FPS/memory require operator hardware** → `PENDING_OPERATOR` in CI/sandbox (honest; not fabricated).

## Validation

```bash
node --experimental-strip-types --test \
  tsm-console/tests/hierarchical-z-contract.test.mjs \
  tsm-console/tests/transvoxel-stitch-contract.test.mjs \
  tsm-console/tests/terrain-coverage-crs-device-contract.test.mjs

node --experimental-strip-types scripts/geospatial/crs-vertical-datum-evidence-report.mjs
```

## Operator remaining

- Deploy Terrain-RGB URL template (`VITE_TSM_TERRAIN_RGB_URL_TEMPLATE`) to move providers to PUBLISHED.
- Run browser harness on representative devices; call `recordDeviceMeasurement`.
- Optional: wire Hi-Z session into OpenWorld3DTilesRenderer depth path when WebGPU depth is available.

**Human authority remains final.**
