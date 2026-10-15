# TSM release-gate register

**Updated:** 2026-10-15  
**Scope:** Repository and console release readiness; this is a status register, not an engineering certification.

## Gates with repository evidence

| Gate | Current evidence | Status |
|---|---|---|
| Public console build and artifact validation | GitHub Actions production-console verification passed for the merged baseline; rerun is required for this feature branch | BASELINE_PASS / FEATURE_BRANCH_PENDING |
| Twin entity invariant checks | Dependency-free checks and negative tests exist | PARTIAL — not full JSON Schema 2020-12 evaluation |
| Public source metadata acquisition | Bounded, allowlisted snapshot tool with hashes and manifests | TOOL_READY / SOURCE_SNAPSHOTS_NOT_ACQUIRED |
| NOAA/NWS source catalog | Official service directory links recorded in `data/sources/noaa-cloudgis-catalog.json` | DOCUMENTED / LIVE_CAPABILITIES_PENDING |
| NOAA Twin Canvas overlays | Opt-in WMS warning and MRMS radar layers with source attribution | IMPLEMENTED / RUNTIME_HEALTH_PENDING |
| Production backend deployment | No verified backend deployment target or live API health evidence | BLOCKED / NOT_CLAIMED |

## Hard release blockers

1. **Select and approve a pilot area of interest (AOI).** Do not silently select a river reach. The AOI determines data coverage, boundary conditions, model extent, and validation targets.
2. **Acquire and qualify source inputs.** For each input, preserve exact source URI, retrieval time, license/terms, source-native ID, checksum, horizontal CRS, vertical datum, units, acquisition/forecast time, and transformation lineage. Do not infer missing datum metadata.
3. **Validate NOAA WMS services in the release environment.** Fetch and parse GetCapabilities, confirm each qualified layer name and CRS, then assert GetMap returns valid image bytes for a Tri-State bounding box. The layer names in the current catalog are provisional until this test passes.
4. **Use full JSON Schema 2020-12 validation.** The existing twin verifier intentionally checks only high-value invariants. A standards-compliant 2020-12 validator must validate the schema itself and all examples, including format assertions and negative fixtures.
5. **Run a real hydraulic model for the approved AOI.** Record solver/version, mesh and terrain inputs, roughness assumptions, boundary conditions, forcing, convergence, calibration/validation evidence, uncertainty, and reproducibility tolerances. A visual water overlay is not model evidence.
6. **Prove deployment separately.** Verify deployed frontend URL, API health, auth, telemetry, database/PostGIS, WebSocket behavior, and operational monitoring independently. A green Vite build does not prove those services exist.
7. **Human engineering review.** No permit, floodway, life-safety, or property-level determination may be promoted from map visualization or unvalidated model output.

## Release policy

- Keep external layers off by default; preserve visible attribution and authority boundaries.
- Never substitute NOAA warning polygons or radar reflectivity for inundation, regulatory flood maps, or calibrated hydraulic output.
- Do not commit live external payloads unless licensing, reproducibility, and retention are reviewed.
- Do not provision paid infrastructure without explicit authorization.
- Keep the pull request unmerged until all applicable code gates pass. Scientific and deployment blockers remain open until supported by evidence.
