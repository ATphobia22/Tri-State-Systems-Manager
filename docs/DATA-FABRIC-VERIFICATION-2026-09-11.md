# TSM Data Fabric Verification — 2026-09-11

## Scope

This verification record covers the non-medical Tri-State Systems Manager data fabric only. Medical, clinical, biomedical, PHI, and IRB application work remains outside this repository and belongs in TMRDS.

## Authoritative source checks

| Source | Runtime status | Verified basis |
|---|---|---|
| USGS Water Data | **Current runtime endpoint** | Modern OGC API at `api.waterdata.usgs.gov`; TSM runtime migrated away from legacy WaterServices. |
| NOAA/NWS NWPS | **Current runtime endpoint** | `api.water.noaa.gov/nwps/v1/`; observed and forecast products remain separate. |
| FEMA NFHL | **Current reference endpoint** | FEMA public NFHL MapServer exposes flood hazard zones, BFEs, levees, LOMRs/LOMAs and related layers. |
| Indiana DNR BAFL | **Current reference authority** | Indiana DNR Division of Water maintains statewide floodplain mapping and BAFL resources. |
| Indiana GIS | **Current reference authority** | Indiana GIS services remain source-native CRS products and must retain service metadata. |
| USGS 3DEP | **Current reference authority** | 3DEP provides current elevation products and spatial metadata; acquired products retain acquisition/version metadata. |
| USACE NLD | **Current reference authority** | NLD publishes GIS/JSON services and explicitly exposes data-last-updated metadata. |

## Runtime invariants

1. Raw observations remain source-native.
2. USGS gage height parameter `00065` remains `GAGE_DATUM` until an explicit, versioned datum conversion is applied.
3. Source retrieval time and upstream observation time are distinct fields.
4. Forecast and observed products are not silently conflated.
5. CRS and vertical datum metadata are mandatory on normalized source records.
6. Provenance hashes are fail-closed.
7. Duplicate evidence hashes are rejected.
8. Simulation/demo data cannot silently claim authoritative observation status.
9. Source failure returns `unavailable`/error state; it does not fabricate continuity.
10. Regulatory-reference source data does not confer regulatory decision authority on TSM.

## Build/deploy verification

The repository CI pipeline is configured to run dependency integrity, supply-chain, repository integrity, source/data gates, parse/typecheck, production build, test suites, artifact attestation, and production artifact upload on `main` pushes. A production deployment is only considered verified after a green CI run for the exact `main` commit.

## Known production architecture boundary

The current evidence store is intentionally a Phase-1 file-backed implementation with a PostgreSQL/PostGIS-ready schema/API boundary. It must not be represented as horizontally durable production storage until a managed PostgreSQL/PostGIS deployment and backup/restore policy are configured.

The current GitHub Pages artifact is a static frontend. The Node API/token proxy is a separate runtime process and must be deployed as an API service; a Pages deployment alone cannot execute the Node server.
