# Hydrology, Hydrokinetic & Geospatial OSS Adoption Review

**Date:** 2026-10-23  
**Implemented:** 2026-10-24  
**Scope:** Tri-State Systems Manager (TSM) — Tri-State River Valley / Indiana-first compliance  
**Reference proposal:** [Sumit77884/culvert-hydro-power--Bihar-Government-Proposal--At-IIT-PATNA-](https://github.com/Sumit77884/culvert-hydro-power--Bihar-Government-Proposal--At-IIT-PATNA-) (concept PDF only). **Not integrated.**

---

## Implementation status (all suggestions)

| Suggestion | Status | Location |
|------------|--------|----------|
| Keep MapLibre / Martin / H3 / PMTiles | Done (existing) | tsm-console, docker tiles profile |
| HEC-RAS operator package + hash | Done | `backend/engineering/hec_ras_worker.py` |
| Official HEC docs (not stale GitHub path) | Done | https://www.hec.usace.army.mil/software/hec-ras/documentation.aspx |
| BullMQ optional adapter | Done | `packages/queues` → `createBullMqQueue` / `createDefaultQueue` |
| Timescale gage telemetry schema | Done | `db/timescale/gage-telemetry-schema.sql` |
| Research model catalog | Done | `contracts/registries/tsm-research-model-catalog-v1.json` |
| BMI / OpenMI coupling notes | Done | `docs/architecture/BMI-OPENMI-COUPLING-NOTES-v1.0.md` |
| Monorepo apps + packages | Done | `apps/*`, `packages/*`, `pnpm-workspace.yaml` |
| Bihar proposal as reference only | Done | Catalog `priority: reference_only` |
| No CFD/solver in public SPA | Policy locked | Catalog `public_spa: false`, `auto_execute: false` |

---

## Ranked adoption for TSM

### P0 — Keep authoritative

| Asset | Role |
|-------|------|
| maplibre-gl-js | Visualization plane |
| martin | PostGIS → MVT |
| h3-js | Spatial aggregation |
| protomaps / PMTiles | Offline / single-file tiles |
| HEC-RAS (USACE HEC docs + worker) | Authority hydraulics |

### P1 — Behind abstractions

| Asset | Implementation |
|-------|----------------|
| BullMQ | Optional when `REDIS_URL` set |
| TimescaleDB | Optional hypertable SQL |
| bmi-python | Interface notes only |
| HydroErr | Metrics in research reports |

### P2 / defer — Isolated research runners

SWMM, AnuGA, Delft3D, MODFLOW6, FloPy, OpenFOAM, turbinesFoam, OpenFAST, DualSPHysics, Elmer, OpenGeoSys, pyrad — listed in research catalog; never auto-run.

---

## Explicit non-goals

1. Do not embed OpenFOAM, Delft3D, or MODFLOW in the public SPA.  
2. Do not treat culvert micro-hydro concepts as flood-risk determinations.  
3. Do not auto-execute any hydraulic solver without operator package + hash.  
4. MapLibre remains presentation authority.

---

## Monorepo mapping

| Package / app | Role |
|---------------|------|
| `@tsm/queues` | Memory default + BullMQ adapter |
| `@tsm/jobs` | ETL / hash / report kinds |
| `@tsm/agent-runtime` | S1 advise default |
| `@tsm/approvals` | Decision records |
| `@tsm/search` | Catalog / gage query model |
| `@tsm/browser` | Capability detect |
| `@tsm/notifications` | Informational sinks |
| `apps/dashboard` | Operator dashboard |
| `apps/playground` | Agent / queue demos |
| `apps/docs` | Doc surface |
| `apps/admin` | Approvals / jobs visibility |
