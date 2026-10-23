# OSS adoption complete — 2026-10-23

All P0 process and geospatial adoption suggestions finished for Tri-State Systems Manager.

## Process (adopted)

| Repo | Status | Location |
|------|--------|----------|
| Fission-AI/OpenSpec | **Adopted** | `openspec/` — AGENTS.md, archived `specs/terrain-gpu`, change `adopt-hiz-transvoxel-coverage` |
| addyosmani/agent-skills | **Adopted (process)** | `.agents/skills/README.md` — install commands; not a runtime dependency |

```bash
npx skills add addyosmani/agent-skills --skill code-review-and-quality
npx skills add addyosmani/agent-skills --skill test-driven-development
```

## Geospatial stack (aligned)

| Component | Status |
|-----------|--------|
| MapLibre GL JS | Core (primary map) |
| Martin / PMTiles | Scale-up path (existing docker profile / docs) |
| PostGIS + H3 | Existing fabric |
| GDAL / Terrain-RGB scripts | Existing `scripts/geospatial/` |
| PROJ / explicit datum | Fail-closed; no silent NGVD29↔NAVD88 |
| GeoLibre / GRASS / GMT | Reference only |

## Terrain GPU finish (code)

| Module | Path |
|--------|------|
| Hi-Z | `tsm-console/src/gpu/hierarchical-z.ts` + `.wgsl` |
| Transvoxel | `tsm-console/src/gpu/transvoxel-stitch.ts` |
| Coverage | `tsm-console/src/lib/terrain-coverage.ts` + AOI manifest |
| CRS evidence | `tsm-console/src/lib/crs-vertical-datum-evidence.ts` |
| Cross-device | `tsm-console/src/lib/cross-device-validation.ts` |
| Tests | `tsm-console/tests/*hierarchical*`, `*transvoxel*`, `*terrain-coverage*` |

```bash
node --experimental-strip-types --test \
  tsm-console/tests/hierarchical-z-contract.test.mjs \
  tsm-console/tests/transvoxel-stitch-contract.test.mjs \
  tsm-console/tests/terrain-coverage-crs-device-contract.test.mjs
```

## Operator remaining (not code)

- Publish Terrain-RGB URL template → provider PUBLISHED
- Hardware device lab → `recordDeviceMeasurement`
- Operator secrets stay outside git

**Human authority remains final.**
