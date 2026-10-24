# TSM Scientific Integration Registry and Adoption Plan

**Status:** architecture triage; no solver is implicitly approved for production.

## Non-negotiable controls

- Archimedes is read-only. A screening result, proof hash, reviewer name, or queue completion must never issue permits, certify no-rise, approve designs, or bypass qualified reviewers.
- Missing inputs, invalid units/CRS/datum, stale evidence, unpinned rules, failed convergence, absent solver artifacts, or missing provenance must produce explicit blocked or NOT_EVALUATED states.
- Separate verified statutory requirements from federal/local requirements, configurable project criteria, and unverified claims. Thresholds require jurisdiction, authority, section, applicability, source URL, effective date, retrieval date, reviewer, and ruleset version.
- Do not claim OpenMI 2.0 conformance for custom gRPC/Protobuf. Label custom adapters as versioned TSM solver-exchange contracts unless conformance is independently verified.
- EPSG:2966 is NAD83 / Indiana West (ftUS), a horizontal CRS; it does not define a vertical datum. Vertical datum, units, epoch, and transformation provenance must be explicit.

## Candidate registry

| Candidate | TSM role | Adoption decision | Main acceptance gates |
|---|---|---|---|
| USACE HEC-RAS / hec-ras-docs | River hydraulics and 1D/2D result ingestion | Adapter-first | Versioned adapter, units/datum, geometry and flow provenance, convergence and mass balance, independent benchmark |
| EPA SWMM | Urban drainage and rainfall-runoff | Optional adapter | Rainfall provenance, units, continuity error, missing time-step policy |
| Deltares Delft3D-FLOW | Hydrodynamics and sediment | Specialist optional adapter | Versioned grids, bathymetry, boundary conditions, convergence, sediment calibration |
| ANUGA | Shallow-water and overland flow | Specialist optional adapter | Mesh/DEM quality, boundary conditions, conservation checks, benchmark validation |
| MODFLOW 6 + FloPy | Groundwater simulation | Optional subsurface integration | Version pinning, discretization, solver convergence, water budget, calibration provenance |
| OpenGeoSys | Coupled porous-media / THMC modelling | Later-stage specialist adapter | Coupling assumptions, mesh and parameter provenance, convergence, benchmark |
| OpenFOAM | High-resolution CFD | Specialist isolated runtime | Reproducible solver build, mesh quality, residuals, conservation, validation |
| DualSPHysics | Free-surface and wave impact | Specialist isolated runtime | Particle resolution, boundary treatment, sensitivity and validated reference cases |
| turbinesFoam | Hydrokinetic turbine actuator-line modelling | Research-only until validated | Compatible OpenFOAM version, turbine parameters, mesh/time-step sensitivity, experiments |
| OpenFAST + ROSCO | Coupled turbine dynamics and control | Not a default river-hydraulics solver | Defined hydrokinetic use case, model applicability, controller version, validation and safety review |
| windpowerlib | Wind-farm energy-yield calculations | Separate optional energy module | Time-series provenance, turbine curves, uncertainty bounds |
| BMI / bmi-python | Model coupling interface | Preferred concept when supported by model | Typed variables, units, grid metadata, lifecycle and error semantics |
| HydroErr | Hydrologic error metrics | Useful validation utility | Metric selection, missing-data policy, units, benchmark datasets |
| pyrad | Radar processing and QPE | Optional precipitation pipeline | Calibration metadata, QC flags, temporal/spatial alignment, uncertainty |
| Protomaps / PMTiles | Offline vector-tile packaging | Strong geospatial delivery candidate | Reproducible build, licensing, attribution, integrity hash |
| MapLibre GL JS | Browser map rendering | Candidate if consistent with existing stack | CSP, accessibility, performance, CRS and attribution |
| H3 | Spatial aggregation/indexing | Utility only; not authoritative geometry | Record resolution; never replace legal parcel/boundary geometry |
| Martin | PostGIS vector-tile serving | Optional when database-backed tiles are needed | Query limits, auth, caching, query plans, tenant isolation |
| TimescaleDB | Gauge/telemetry time series | Only if current storage is insufficient | Retention, migrations, backup/restore, timestamps, load tests |
| BullMQ / Bull | Background jobs | Prefer one queue library; BullMQ if Redis is already available | Idempotency, bounded retries, dead letters, cancellation, audit; jobs cannot authorize governance |
| Bihar culvert hydropower proposal | Candidate design/evidence source | Audit only; not approved design evidence | Reproduce equations, verify inputs/boundaries, independent hydraulic/structural/environmental review |

## Integration order

1. **Plane 2 contracts:** define a versioned typed solver-exchange envelope with schema version, solver name/version, input/output hashes, units, horizontal CRS, vertical datum, time convention, grid/mesh metadata, convergence status, quality flags, provenance, and explicit NOT_EVALUATED/BLOCKED outcomes. Reject unknown units, unsupported CRS/datum, missing timestamps, non-finite values, and invalid convergence evidence.
2. **Plane 3 Archimedes gate:** deterministic read-only evaluation. Apply a criterion only when source, version, applicability, and review status are pinned. Missing or ambiguous criteria block the gate. Recorded review metadata is not design or permit authorization.
3. **Proof manifests:** canonical UTF-8 JSON with sorted keys, fixed separators, and allow_nan=false. Hash input records, solver artifacts, ruleset version, evaluation, and manifest. SHA-256 proves byte-level integrity only—not origin, authenticity, correctness, or approval. Digital signatures require separate key management.
4. **Validation:** tests for unit conversion, CRS/datum mismatch, timestamp ordering, missing data, non-convergence, stale evidence, reproducibility, hash mutation, and fail-closed behavior. Preserve every existing CI/release gate.
5. **Adapters and infrastructure:** implement only after contract and benchmark tests pass. Keep heavyweight solvers out of web/API runtime; use isolated, pinned workers and explicit resource/time limits.

## Release gates

- No default-allow behavior; ambiguous or unhandled conditions block.
- Never infer NAVD88 from a horizontal CRS or gauge datum.
- Never call missing solver output converged; never treat missing delta as zero.
- Never represent a proposal, demo, or uncalibrated run as validated engineering evidence.
- Do not install a dependency solely because it appears in this registry; review licensing, maintenance, compatibility, threat model, reproducible build, and operational cost.
- CI must cover positive and negative cases. Do not disable, downgrade, or bypass existing checks to obtain green status.

## Reference repositories

- [HEC-RAS docs](https://github.com/USACE-HEC/hec-ras-docs); [EPA SWMM](https://github.com/USEPA/Stormwater-Management-Model); [Delft3D-FLOW](https://github.com/Deltares/Delft3D-FLOW); [ANUGA](https://github.com/tuxand/AnuGA)
- [MODFLOW 6](https://github.com/MODFLOW-USGS/modflow6); [FloPy](https://github.com/MODFLOW-USGS/flopy); [OpenGeoSys](https://github.com/OpenGeoSys/ogs); [OpenFOAM](https://github.com/OpenFOAM/OpenFOAM-dev); [DualSPHysics](https://github.com/DualSPHysics/DualSPHysics)
- [OpenFAST](https://github.com/OpenFAST/openfast); [ROSCO](https://github.com/NatLabRockies/ROSCO); [windpowerlib](https://github.com/wind-python/windpowerlib); [BMI Python](https://github.com/pygeodev/bmi-python); [HydroErr](https://github.com/HYETS/Hydroerr); [pyrad](https://github.com/MeteoSwiss/pyrad)
- [Protomaps](https://github.com/protomaps/basemaps); [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js); [H3 JS](https://github.com/uber/h3-js); [Martin](https://github.com/maplibre/martin); [BullMQ](https://github.com/taskforcesh/bullmq); [Bull](https://github.com/OptimalBits/bull); [TimescaleDB](https://github.com/timescale/timescaledb)
- [Culvert hydropower proposal](https://github.com/Sumit77884/culvert-hydro-power--Bihar-Government-Proposal--At-IIT-PATNA-)

## Evidence limitations

This registry is architecture triage, not a completed compatibility, security, licensing, benchmark, or scientific validation audit. Repository names and README claims do not establish suitability for a TSM site. Verify exact releases, licenses, runtime requirements, interoperability, and applicable standards before enabling each adapter.
