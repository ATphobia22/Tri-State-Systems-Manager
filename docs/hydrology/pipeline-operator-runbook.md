# Hydrology pipeline preflight runbook

## Scope and safety boundary

`scripts/hydrology/tsm_pipeline.sh` is a **preflight/evidence-screening tool**, not a solver launcher. It must not be described as a completed HEC-RAS run. It does not modify HEC-RAS geometry, generate an unverified `.u01`, invoke HEC-RAS, export GIS, or send notifications.

The script is deliberately fail-closed. A structurally valid hydrograph can reach the final lock and still return exit code 3 because there is no verified, version-specific solver adapter enabled.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | Reserved; not currently emitted as a successful end-to-end run |
| 1 | Required executable or input missing / preflight setup failure |
| 2 | Telemetry evidence or hydrograph validation failed |
| 3 | Preflight checks passed for review, but model execution remains locked |

A preflight report with `execution_allowed: false` is expected. It is not a solver authorization.

## Inputs

Required:
- `TSM_HYDROGRAPH_CSV` (default: `modelling_zone/boundary.csv`): CSV with `timestamp`, `flow_cfs`, and `froude_number` columns.
- `TSM_TELEMETRY_EVIDENCE_JSON`: separate JSON evidence with `verified: true`, a matching `gauge_id`, and timezone-aware `observed_at`.
- `TSM_BOUNDARY` (default `WABASH_COMPONENT_03378500`), `TSM_GAUGE_ID` (default `03378500`), and `TSM_NORMAL_DEPTH_SLOPE_FT_FT` (default `0.0004`). This validates one Wabash component gauge only; it is not the total Wabash inflow boundary described in ERDC/CHL TR-22-4.

Optional:
- `TSM_HEC_RAS_LOG`: screens an existing log only. Log-token recognition is version/configuration dependent; the result is not independent proof of convergence.
- `TSM_HDF5_PATH`, `TSM_WSE_DATASET`, and `TSM_CELL_CENTER_DATASET`: require all three together. The current preflight does not export or transform the HDF5 result.

Output locations can be changed with `TSM_LOG_DIR`, `TSM_REPORT_DIR`, and `TSM_DATA_DIR`.

## Run locally

From the repository root:

```bash
bash -n scripts/hydrology/tsm_pipeline.sh
python -m unittest discover -s tests -p 'test_hydrology_pipeline.py' -v
```

The integration tests use temporary files and deliberately assert that even valid review-only evidence cannot start the solver.

## Requirements before enabling a model run

Do not remove the final lock until each item has a recorded implementation and verification artifact:

1. **Solver adapter:** identify the installed HEC-RAS version/build and confirm its documented invocation, project/plan selection, process exit behavior, and output locations against the official version-matched documentation. Do not assume command-line flags.
2. **Input provenance:** acquire and hash authoritative terrain, hydrography, precipitation/flow inputs, boundary conditions, and geometry; record source IDs, URLs, retrieval times, CRS, vertical datum, units, and license/usage restrictions.
3. **AOI and catchment:** keep parcel, building footprint, catchment, hydraulic domain, and downstream receiving outlet as distinct geometries. Verify the outlet against conditioned terrain, hydrography, culverts, barriers, and other relevant evidence. The candidate AOI remains unapproved until these checks are reviewed.
4. **Hydraulic validity:** derive Froude numbers from documented geometry and hydraulic state; a user-supplied numeric column alone is not proof that the values are physically valid. Confirm slope, roughness, boundary conditions, timestep, mesh, and stability criteria for the specific model.
5. **Versioned result reader:** inspect an actual result file from the targeted HEC-RAS version; verify HDF5 dataset paths, units, horizontal CRS, vertical datum, missing values, mesh/cell association, and time selection before exporting WSE.
6. **Independent quality gates:** test with known-good and deliberately invalid fixtures, and compare outputs to independent benchmarks where applicable. A clean text log is not enough.
7. **Approval and audit:** require an explicit human approval bound to the exact AOI/input/configuration hashes; record software versions, run ID, logs, warnings, output hashes, and reviewer. Keep public-safety conclusions and stakeholder alerts disabled until the results have passed review.

## Authoritative source discovery

Use the official, version-matched USACE HEC-RAS documentation for solver behavior; USGS 3DEP/3D Hydrography and applicable StreamStats products for terrain/hydrography and catchment cross-checks; and FEMA effective mapping plus relevant state/local floodplain sources for regulatory context. Catalog availability is not proof of site coverage, currency, datum compatibility, or engineering suitability. Record the exact product, date, URL, and hash of every input used.

## Release status

The pipeline is ready for preflight and evidence-screening tests only. It is **not** approved for HEC-RAS execution, flood-depth/BFE/no-rise/design-flow conclusions, permit determinations, GIS publication, or automatic safety alerts.
