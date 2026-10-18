# Cross-Fabric Readiness — 2026-10-18

## Contract gate

`tsm-console/tests/cross-fabric-contract.test.ts` checks map-plane alignment with the structural layer registry, unique registry IDs, renderable default-visible layers, and explicit source/CRS/vertical-datum/verification metadata in the tile manifest. It also checks that NOAA NWPS and modern USGS observations are active only for user-triggered snapshots, NOAA NWM remains retired, and the NOAA forecast tile stays pending. The test is included in `npm run test:renderer-contracts`.

## Open reconciliation gate

The live-hydrology registry now enables NOAA NWPS and modern USGS Water Data for user-triggered read-only observations, with automatic polling prohibited. NOAA NWM remains retired, and the geospatial forecast tile stays pending. Adapter configuration is not proof of a successful live response: release evidence still needs a captured snapshot, per-station freshness/units/provenance checks, and AOI applicability review.

## Completion criteria

1. Set one status per source: active, retired, unavailable, or discovery-only.
2. Align runtime configuration, UI registry, tile manifest, docs, and tests with the same status.
3. Keep live fetches bounded; preserve source timestamps and units; never synthesize fallback observations.
4. Validate tile format, geometry, CRS, vertical-datum policy, lineage, checksum, and reproducible build receipt before publication.
5. Keep FEMA effective mapping and Indiana Best Available mapping as separate authority classes.
6. Check AOI overlap before claiming that a dataset is usable for the Lower Wabash / Ohio River target region.
7. Verify CI and artifact integrity against the exact merge commit before claiming production readiness.

This record is a readiness contract, not a claim that every source has been acquired or every operational gate has passed.
