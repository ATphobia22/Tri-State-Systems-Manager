# Martin Photorealistic Tile Fabric Verification

## Scope

This record covers the integration of the user-owned `ATphobia22/martin` repository into the TSM open-world visualization architecture.

## Implemented contracts

- Martin configuration: `ops/martin/config.yaml`
- Martin deployment guidance: `ops/martin/README.md`
- OGC 3D Tiles manifest: `artifacts/tsm-3d-tiles-fabric-v1.json`
- Martin/3D Tiles resolver: `tsm-console/src/lib/martin-tile-fabric.ts`
- 3D Tiles renderer-facing contract: `tsm-console/src/components/OpenWorld3DTilesLayer.tsx`
- Vitest contract coverage: `tsm-console/tests/martin-tile-fabric.test.ts`

## Source boundaries

Martin is a delivery/cache plane. Indiana Current Imagery, USGS 3DEP, FEMA, Indiana DNR, USGS hydrology, NOAA/NWS, USACE, HEC-RAS and other authoritative sources remain registered independently in TSM. Visualization tiles do not become regulatory or engineering truth.

OGC 3D Tiles sources are intentionally not fabricated. A tileset URL must be explicitly registered and must use HTTP(S).

## Verification status

- Repository writes: implemented on `main`.
- Static source contracts: implemented.
- Targeted automated test: queued in GitHub Actions through `test:martin`.
- Full CI: pending final GitHub Actions result for the resulting `main` head.

## Completion rule

Do not mark this record as fully verified until the relevant GitHub Actions workflow completes successfully and the exact run ID and commit SHA are recorded here.
