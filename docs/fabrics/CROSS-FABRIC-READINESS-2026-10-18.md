# Cross-Fabric Readiness — 2026-10-18

## Contract gate

`tsm-console/tests/cross-fabric-contract.test.ts` checks map-plane alignment with the structural layer registry, unique registry IDs, renderable default-visible layers, and explicit source/CRS/vertical-datum/verification metadata in the tile manifest. It also checks that retired live-hydrology sources carry a retirement reason. The test is included in `npm run test:renderer-contracts`.

## Open reconciliation gate

The live-hydrology registry says NOAA NWPS/NWM live river sources were retired by an owner decision. Other registry, tile-manifest, and runtime files still describe or reference live river products. Project documentation also describes USGS observations and NOAA/NWS products as hydrology context. Until this is reconciled, TSM must not claim that live hydrology is uniformly enabled, disabled, or production-healthy. A source catalog entry is not proof of polling, freshness, geographic applicability, or engineering suitability.

## Completion criteria

1. Set one status per source: active, retired, unavailable, or discovery-only.
2. Align runtime configuration, UI registry, tile manifest, docs, and tests with the same status.
3. Keep live fetches bounded; preserve source timestamps and units; never synthesize fallback observations.
4. Validate tile format, geometry, CRS, vertical-datum policy, lineage, checksum, and reproducible build receipt before publication.
5. Keep FEMA effective mapping and Indiana Best Available mapping as separate authority classes.
6. Check AOI overlap before claiming that a dataset is usable for the Lower Wabash / Ohio River target region.
7. Verify CI and artifact integrity against the exact merge commit before claiming production readiness.

This record is a readiness contract, not a claim that every source has been acquired or every operational gate has passed.
