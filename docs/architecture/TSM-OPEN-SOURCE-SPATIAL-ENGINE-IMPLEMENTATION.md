# TSM open-source spatial engine implementation plan

**Status:** implementation contract and rollout gates; not a claim that every external engine is installed or running.

## Decision policy

Use external projects as isolated capability providers. Do not absorb an engine wholesale without license, maintenance, security, resource, and offline-runtime review. A passing schema or build check establishes structural integrity only; it does not establish scientific validity, regulatory authority, or suitability for a real AOI.

## Account-free work that can be performed in CI

| Capability | Preferred component | Gate |
|---|---|---|
| 2D operational map | MapLibre GL JS | Browser smoke test against fixture data; validate source/layer IDs and no external credential requirement |
| Custom 3D scenes | Three.js | Deterministic unit tests and WebGL/WebGPU feature detection; graceful fallback |
| Globe/terrain/3D Tiles | CesiumJS | Validate local tileset metadata, referenced assets, CRS/height semantics, and SHA-256 manifest |
| High-volume analytic overlays | deck.gl | Optional adapter; add only when a measured rendering requirement exists |
| Dynamic vector tiles | Martin + PostGIS | Offline config/schema tests now; live DB health and query tests only where an authorized database is available |
| Portable/offline tiles | PMTiles / MBTiles | Local artifact metadata, tile-range, hash, and read-after-build checks |
| Tile packaging | Tippecanoe | Pinned CLI version and deterministic fixture output; no external API token required |
| Raster/vector ETL | GDAL | Fixture-based reprojection and nodata/unit/CRS checks; pin version |
| Spatial aggregation | H3 | Treat as derived index; verify stable resolution and geometry-to-cell behavior |
| Desktop QA | QGIS | Analyst workflow and export fixtures; not a production web-runtime dependency |
| Infrastructure twins | iTwin.js | Defer unless an explicit interoperability need and license review pass |
| Standalone simulation clients | Godot, O3DE, Panda3D, Babylon.js, Bevy | Do not add all five. Select one only for a concrete native/interactive requirement; keep the web renderer as the default |
| Traffic simulation | CARLA | Optional; requires a pinned runtime and a defined road/vehicle scenario |
| Surface-water hydraulics | HEC-RAS | Adapter must capture project/plan hashes, solver version, boundary conditions, output HDF metadata, units, and reviewer status |
| Groundwater | MODFLOW 6 | Adapter must capture discretization, packages, solver version, input/output hashes, convergence diagnostics, water-budget checks, and uncertainty |
| CFD | OpenFOAM | Adapter must capture mesh, boundary conditions, solver dictionary, version, residual/convergence data, units, and output hashes |

## Required data-to-map release path

1. Retrieve source metadata and preserve its authority, terms/license, retrieval time, valid time, and original payload hash.
2. Validate source schema, geometry, CRS, vertical datum, units, and quality flags. Reject ambiguous datum transformations.
3. Store the normalized dataset and provenance in durable storage; a registry entry alone is not ingestion.
4. Produce versioned tiles or an explicitly versioned PostGIS query result. Hash the exact published artifact.
5. Smoke-test tile retrieval and render the exact artifact in MapLibre or Cesium. A source name or HTTP 200 alone is insufficient.
6. Record source, transform, toolchain, artifact and evidence hashes in the evidence ledger. Never mark a model scientifically validated merely because its process exited zero.

## Solver run contract

The companion `spatial-solver-run-manifest-v1.schema.json` provides a shared metadata contract for HEC-RAS, MODFLOW 6, OpenFOAM, CARLA, and other specialized engines. It records solver/version, configuration hash, execution status, spatial reference, input/output hashes, provenance, uncertainty, validation checks, and human review.

The included example is explicitly a **synthetic fixture**. It is not a model run, AOI approval, calibration, flood prediction, or engineering conclusion. Execution should be blocked until project-specific AOI approval, authoritative inputs, coordinate/datum/units verification, pinned solver/runtime, and a validation plan are all present.

## Credential boundary

The implementation path above does not require adding secrets or connecting new paid accounts. Public source endpoints and local fixtures can be tested without credentials. Production PostGIS connectivity, private infrastructure, proprietary solver installation/licenses, and any service requiring an account remain gated; do not invent credentials or silently substitute illustrative outputs.

## Acceptance checklist

- [ ] CI validates the solver manifest schema and example.
- [ ] Invalid hashes, unsupported fields, invalid solver status and missing provenance fail tests.
- [ ] Tile and solver outputs are reproducible or documented as non-deterministic with the reason and tolerances.
- [ ] AOI, CRS, vertical datum, units, source terms, and solver version are explicit.
- [ ] Scientific checks are separate from execution status and require human review for decision-support runs.
- [ ] Live service checks are reported as unavailable/skipped when no authorized endpoint is configured, never reported as passing by assumption.
