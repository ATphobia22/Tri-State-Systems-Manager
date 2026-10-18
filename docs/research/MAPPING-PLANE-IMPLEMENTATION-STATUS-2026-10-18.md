# Mapping-plane implementation status and remaining gates

**Review date:** 2026-10-18  
**Base:** `main` merge commit `6516528cd8ca7be28d965c9112a038df071ec54f`  
**Purpose:** turn the geospatial mapping-plane roadmap into evidence-backed implementation and release gates. This is a status record, not a declaration that every plane or model is production-complete.

## Plane-by-plane implementation map

| Plane | Existing contract / implementation anchors | Release evidence required | Status |
|---|---|---|---|
| Evidence & Data Governance | `data/acquisitions/tsm-authoritative-source-manifest-v1.json`, `data/acquisitions/tsm-data-plane-integration-v1.json`, `data/schemas/evidence-manifest.schema.json`, `scripts/ci/validate-provenance-plane.mjs`, source manifests under `data-sources/manifests/` | Source URL/query, retrieval timestamp, vintage, CRS and vertical datum, units, raw and parsed SHA-256, freshness and failure state; a missing or failed source must not become empty-data success | Implemented contracts and checks; each source still needs live freshness/coverage evidence for the target AOI |
| Scientific & Simulation | `docs/hydrology/HEC-HMS-RAS-REPRODUCIBLE-WORKFLOW.md`, `docs/hydrology/HYDROLOGY-RELEASE-CONTRACT.md`, `scripts/hydrology/run-hec-coupled-workflow.mjs`, HEC run-manifest schemas | Approved scientific question and domain; verified terrain, hydrography, rainfall/gage, datums, boundary conditions, solver version, mass balance/convergence, output hashes, independent QA | Workflow and contracts exist; a home-site model run remains blocked until the AOI and input gates pass |
| Governance & Decision | `docs/FOUR-PLANE-ARCHITECTURE.md`, `data/schemas/tsm-four-plane-architecture-v1.json`, jurisdiction and approval contracts | Human approval and auditable evidence for decisions; explicit authority class; no inferred result silently promoted to regulatory or engineering determination | Architecture contract exists; approval is case-specific and is not implied by a successful CI run |
| Public Experience / Visualization | `docs/TSM-LOD-CONTRACT.md`, `docs/WEBGPU-PRESENTATION-CONTRACT.md`, `scripts/geospatial/build-hlod-tileset.py`, `scripts/geospatial/validate-building-3d-tiles.py`, MapLibre primary renderer and optional WebGPU presentation path | Valid tileset and content, CRS/transform/bounds checks, stable feature identity, provenance, renderer camera-path/refinement tests, asset and frame-time budgets | HLOD geometric-error regression gate added in this change; representative renderer and performance tests remain release gates |

## HLOD geometric-error policy

The HLOD builder previously assigned intermediate nodes `rootError / 2**depth`. Depth alone is not a measurement of geometric simplification error. The builder now assigns each generated internal node the maximum declared `geometricError` of source content in that node's subtree, using the source root error only when a source content tile omits its own value. Invalid, negative, boolean, NaN, or infinite error values fail closed.

This is a **conservative TSM policy for contentless ADD hierarchy nodes**, not a claim that OGC requires every parent error to be greater than or equal to every child error. It may cause additional refinement when descendant errors remain high. It must be evaluated against representative target-renderer camera paths and payload/frame-time budgets before performance claims are made.

Regression command:

```sh
python3 scripts/geospatial/test_build_hlod_geometric_error.py
```

The repository's strict validator remains necessary, but numeric validity alone does not prove that a geometric-error model yields appropriate runtime refinement.

## Independent 3D Tiles validation

Use the OGC 3D Tiles 1.1 specification as the normative contract and the CesiumGS 3D Tiles Validator as an independent structural/content validation tool:

- [OGC 3D Tiles 1.1 specification](https://docs.ogc.org/cs/22-025r4/22-025r4.html)
- [CesiumGS 3D Tiles Validator](https://github.com/CesiumGS/3d-tiles-validator)

The validator supports 3D Tiles 1.0/1.1 structure and tile-content validation. A successful validator run does not replace application-specific HLOD camera-path tests, hydraulic input QA, or engineering review.

## Home-site hydrology AOI readiness

The repository's candidate site record is `data/posey-county/evidence/13101-bonebank-road-site-aoi-v1.json`. Its status is `USER_SELECTED_CANDIDATE_NOT_ENGINEERING_APPROVED`; its approval is `NOT_APPROVED`. Treat this as a candidate parcel/site evidence record only.

Required gates before an authorized HEC-HMS or HEC-RAS run:

1. Reconcile authoritative parcel and address identity with the candidate structure footprint and current imagery.
2. Acquire and QA a site DEM, its vertical datum/resolution/nodata/coverage, hydrography, drainage infrastructure, and applicable flood products; preserve independent source provenance and hashes.
3. Keep parcel, contributing catchment, and hydraulic model domain as distinct geometries. Do not infer the watershed from the parcel.
4. Establish an evidenced outlet and independent catchment QC; do not label a terrain-derived elevation as survey-grade.
5. Resolve model inputs, boundary conditions, units/datums, solver environment and validation thresholds; record uncertainty.
6. Keep `BLOCKED_NOT_RUN` until input gates pass and a human approves the scientific question and scope.

The available single-point USGS elevation sample and parcel-centroid FEMA intersection are not sufficient to establish flood depth, base flood elevation, a catchment boundary, or design conditions. An address or successful build cannot authorize a model run.

## Release status snapshot

At review time, GitHub Actions reported successful post-merge runs on commit `6516528cd8ca7be28d965c9112a038df071ec54f` for production build/deploy, CI pipeline, parse gate, CodeQL, secret scanning, open-world validation, standard offline runtime, Windows x64 offline runtime, and eight-county boundary acquisition. The Windows x64 artifact was uploaded successfully; artifact ID `12124805594`, SHA-256 `3df98006ccfb989b4fda9a03f49a9fe4f7cec2735d23a54ff255b403fdfc1ebd`, expires 2026-11-17.

This is a snapshot of the reviewed commit, not a promise that later commits remain green. Check the current `main` head and its required checks for each release.
