# Executive Flood-Platform Review — Verification Against the Actual Repository

Date: 2026-09-25. Review under test: the owner-shared "Executive Summary"
flood risk platform plan (20 tasks, ~252 h, Gantt to Mar 2027).

## Verdict

The review was written against an **assumed** repository (`python/`,
`app/applet/src`, `database/migrations/`) — its own words: *"In practice we
would generate this from the actual repo listing."* The actual repository
(`tsm-console/`, `tsm-console/server/`, `db/migrations/`, `backend/`, `tools/`,
`ops/postgis/`) already implements a large share of what the review marks
**missing**. Applying its task list literally would rebuild existing modules
and introduce a second stack (Cesium, TimescaleDB) the repo deliberately does
not use (MapLibre/Three.js, PostGIS).

What survives verification: a short list of **genuine gaps** (§3). Everything
else is done, partial, or not applicable.

## Task-by-task mapping (review's 20 tasks → actual status)

| # | Review task | Actual status in this repo |
|---|---|---|
| 1 | Project setup and inventory | **Done** — this document series; repo fully inventoried 2026-09-24/25 |
| 2 | Environment/Infrastructure (Docker/K8s, CI) | **Done** — Compose files, GitHub Actions incl. iOS workflow |
| 3 | Database & config (PostGIS/Timescale) | **Done (PostGIS)** — `db/migrations/`, `ops/postgis/migrations/`; TimescaleDB is **not applicable** (not the repo's stack) |
| 4 | FEMA NFHL ingestion | **Done** — `tsm-console/server/ingestion/fema-nfhl.mjs` (+ tests) |
| 5 | State flood layers | **Done (Indiana)** — `indiana-gis.mjs`; other states partial |
| 6 | USGS streamflow API | **Done** — `river-network-api.mjs`, `river-network.mjs` (+ tests) |
| 7 | NOAA weather data | **Done** — `noaa-nwps.mjs`, `nws-weather.mjs` (+ tests) |
| 8 | Terrain/DEM processing | **Partial** — `usgs-tnm.mjs` (The National Map) exists; `TERRAIN-RGB-3DEP-PIPELINE.md` documents the pipeline; no full LiDAR-merge job |
| 9 | Hydrologic modeling (rainfall→runoff) | **Genuine gap** — no HEC-HMS/PyNHD/curve-number implementation found |
| 10 | Hydraulic modeling (HEC-RAS) | **Partial** — 1D Saint-Venant C++ solver exists; HEC-RAS worker is fail-closed with no model packages/executable; no 2D |
| 11 | Depth calculations | **Partial** — exists inside simulation WSE migration (`ops/postgis/migrations/20260918_simulation_wse.sql`); not a standalone service |
| 12 | Exposure database | **Partial** — `src/lib/buildingsService.ts` exists; no parcel-wide building inventory load |
| 13 | Damage/Loss engine (Hazus) | **Partial** — `src/lib/hazus-illustrative.ts` is illustrative only; no full depth-damage engine |
| 14 | Evidence workflow (FIRMette) | **Partial** — `tools/loma/build_loma_packet.py`, `src/lib/fema-loma-evidence.ts` exist; no dedicated FIRMette generator |
| 15 | Digital Twin frontend (Cesium) | **Not applicable as specified** — repo twin is MapLibre/Three.js (`src/digital-twin/`); Cesium would be a second stack |
| 16 | Operations & scenario control | **Partial** — telemetry ingestion exists; scenario runner/alerting incomplete |
| 17 | Provenance & metadata | **Done (core)** — evidence ledger, SHA-256 content addressing, `data-fabric-provenance.mjs`, source-health tracking; the review's label taxonomy (FEMA-effective vs State-best, observed vs modeled) is **adoptable** |
| 18 | Testing & validation | **Done (framework)** — 200 node tests + 84 vitest + pytest; NFHL-vs-FIRM validation cases not yet encoded |
| 19 | CI/CD & security | **Done** — workflows green; hardcoded-secret report was a false positive (env-var convention verified) |
| 20 | Documentation & reporting | **Partial** — docs extensive; automated engineer-ready PDF reporting incomplete |

## Genuine gaps worth scheduling (§3 = the real roadmap)

1. **Rainfall-runoff hydrology module** (review task 9) — the single biggest
   modeling gap. No curve-number / HEC-HMS-class implementation exists.
2. **Full Hazus depth-damage engine** (task 13) — promote `hazus-illustrative.ts`
   to real curves with building-type tables.
3. **FIRMette generator** (task 14) — complete the evidence workflow on top of
   the existing LOMA packet builder.
4. **2D hydraulic capability** (task 10) — repo has 1D; decide build-vs-revise
   per docs/EXECUTIVE-REVIEW-VERIFICATION.md.
5. **Scenario runner + alerting** (task 16) — operations layer completion.
6. **Adopt the provenance label taxonomy** (task 17) — FEMA-effective /
   State-best / observed / modeled tags on outputs.
7. **LiDAR-merge job** (task 8) — operationalize the documented 3DEP pipeline.

## Not applicable

- **Cesium** (task 15 as specified): the repo's twin is MapLibre/Three.js by
  design; a Cesium rewrite is a product decision, not a gap fix.
- **TimescaleDB** (tasks 2–3): not the repo's stack; time-series needs are met
  by existing patterns.
- **Team/timeline assumptions** (6 people, ~6 months, 252 h): the operating
  reality is owner + agent; schedule tasks by priority, not headcount.
- **"Build-fail?" on archimedes_engine.py**: the file exists at
  `backend/governance/archimedes_engine.py` (Drive-consolidated 2026-09-25);
  builds are green.

## Recommendation

Do not execute the review's 20-task plan as written. Execute the 7 genuine
gaps above, in order, against the existing architecture. Estimated scope is a
fraction of the review's 252 hours because the ingestion, provenance, CI, and
test foundations it budgets for already exist and are green.
