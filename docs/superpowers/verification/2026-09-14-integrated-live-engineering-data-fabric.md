# Integrated Live Engineering Data Fabric — Verification Record

**Repository:** `ATphobia22/Tri-State-Systems-Manager`  
**Branch:** `main`  
**Date:** 2026-09-14  
**Implementation status:** integrated on `main`; final CI/E2E verification is still running after the latest corrective commits.

## Current authoritative-source verification

- USGS released Water Data API V1 on September 4, 2026 and is decommissioning legacy WaterServices during the final NWISWeb decommission campaign. TSM runtime USGS ingestion therefore targets the modern Water Data API V1; the legacy parser remains fixture/replay-only. 
- NOAA/NWS NWPS remains the official source for NWS streamflow observations, forecasts, National Water Model output, crest history and flood-category metadata.
- Indiana DNR INFIP exposes FEMA and DNR floodplain information and the Indiana Best Available Floodplain Layer.
- Indiana DNR's current Best Available service is registered from the official Indiana GIS ArcGIS REST service.
- USGS 03322420 is retained under its official station identity **OHIO RIVER AT UNIONTOWN DAM, KY**. John T. Myers Locks and Dam is modeled as related infrastructure, not as a replacement station name.
- USGS 03322000 station metadata reports 328.32 ft NAVD88 for gage/land-surface altitude; TSM does not silently convert parameter 00065 gage height using station altitude.

## Implemented task set

| Task | Implementation evidence |
|---|---|
| 1. Canonical telemetry | `data/schemas/telemetry-envelope-v1.schema.json`, `tsm-console/server/telemetry/contracts.mjs` |
| 2. USGS WDFN V1 ingestion | `tsm-console/server/ingestion/usgs-nwis.mjs` now targets `/ogcapi/v1/collections/latest-continuous`; V0/legacy URLs remain only in replay fixtures. |
| 3. Canonical station authority | `tsm-authority-registry-v35.json`, `artifacts/tsm-river-valley-realtime-stations-v1.json` include 03378500, 03322000, 03322420 and NOAA/NWPS context. |
| 4. Safe vertical datum handling | `tsm-console/server/ingestion/workers.mjs`, `tsm-console/src/lib/gage-datums.ts`; station altitude is not silently treated as gage-zero conversion. |
| 5. Concurrent USGS/NWPS ingestion | Hydrologic worker performs bounded concurrent retrieval with explicit request timeouts, freshness classification and provenance hashing. |
| 6. Prometheus hydrologic metrics | `tsm-console/server/telemetry/prometheus-exporter.mjs` exposes stage/discharge gauges and ingestion counters. |
| 7. WebSocket routing | Existing `websocket-router.mjs`, `websocket-endpoint.mjs`, authenticated `/ws/telemetry` gateway; no duplicate Python gateway introduced. |
| 8. HEC-RAS HDF5 discovery | `backend/engineering/hecras_hdf5.py`; dynamic 2D Flow Area / Water Surface discovery. |
| 9. Real base/proposed no-rise | `backend/engineering/no_rise.py`; paired real HEC-RAS Water Surface arrays, explicit governing criterion and model hashes. |
| 10. Bishop reproducibility | `backend/engineering/bishop.py`; deterministic inputs, convergence, method version and SHA-256 input provenance. |
| 11. BFE provenance | `backend/evidence/bfe_provenance.py`; finite numeric validation plus source/service/layer/feature/effective-date/datum/retrieval/hash record. |
| 12. FEMA/Indiana geospatial fabric | `artifacts/tsm-geospatial-tile-fabric-v1.json`; FEMA effective and Indiana Best Available layers remain distinct; current Indiana DNR FeatureServer is registered. |
| 13. River/dam influence evidence | Existing river registry and `data/schemas/river-influence-graph.schema.json` distinguish candidate structures from derived hydraulic relationships. |
| 14. Dredged-material evidence | Existing `data/schemas/dredged-material.schema.json` and engineering tests require material characterization, environmental testing, chain-of-custody and review state before engineering review. |
| 15. Engineering section/material routing | Existing engineering test suites enforce provenance for physical layers, unqualified-fill rejection and volume conservation. |
| 16. Alertmanager security | `ops/alertmanager/alertmanager.yml` + authenticated TLS reverse-proxy `Caddyfile`; Alertmanager is not intended for direct public exposure. |
| 17. Automated validation | CI includes telemetry, source-fabric, geospatial, engineering, privacy, deployment, evidence, reliability and build gates. |
| 18. Open-World Twin | Existing geospatial source manifest, resolver, terrain/imagery layers, overlays, hydrologic synchronization and MapLibre integration remain the presentation plane. |

## Engineering boundaries enforced

- Observation cadence is not conflated with simulation or rendering frequency.
- Raw gage height remains in the source product datum; vertical conversion is explicit and provenance-bearing.
- EPSG:2966 is treated as a horizontal CRS, never as NAVD88.
- HEC-RAS output is never replaced by synthetic hydraulic values.
- No-rise requires actual paired base/proposed model outputs and an explicitly supplied governing criterion.
- Bishop factor of safety is a computational result, not a universal regulatory threshold.
- BFE source values remain distinguishable from derived model elevations.
- Forecasts and observations remain separate temporal classes.
- Cryptographic integrity does not establish physical correctness or regulatory acceptance.
- Public visualization remains decision-support content and cannot self-promote to agency acceptance or engineering certification.
- Private residential identifiers are not introduced into the public engineering-data contract.
- C++ gRPC service code was not introduced because no authoritative repository protobuf/service contract was found; production transport is not allowed to fall back to insecure fabricated services.

## CI incident and remediation

The first post-integration CI run (`34867991702`) failed only in the geospatial-tile-fabric suite. Root cause was identified from the runner log: the manifest was intentionally bumped to schema version `1.1.0` and the 2025 parcel asset had been removed, while existing contract tests still required `1.0.0` and `indiana-parcels-2025`. The manifest was corrected to restore the 2025 asset and the contract test was updated to the explicit `1.1.0` contract.

A subsequent CI run was superseded/cancelled while a new verification run was being started. The latest PTDT E2E run for commit `40af1c0e44822883d9b05149222037853d0c9854` was still in progress at the time of this record. No final green CI claim is made here.

## Verification statement

This document records implementation and evidence-driven remediation. It does **not** pre-claim that the final CI/E2E run passed. The authoritative completion state is the GitHub Actions result for the final `main` commit after all verification workflows finish.
