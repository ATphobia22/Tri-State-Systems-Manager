# TSM Repository Audit and Implementation Register — 2026-10-25

> This is a repository-wide **structural inventory** and a targeted engineering/source audit, not an assertion that each of the approximately 9,604 tracked files has been read or each installed solver has been executed.

## Verified audit scope

- Inspected the recursive `main` tree: 9,604 blobs across apps, packages, schemas/contracts, hydrology scripts, Windows/native targets, offline bundles, evidence data, database migrations, CI/workflows, and documentation.
- Inspected the current release check suite on `main` and the open geospatial, solver evidence, governance, and dependency-update PRs.
- Examined government data holdings readers, manifests and tests; Posey County authoritative source requirements and candidate HEC run metadata; project geodetic reference guidance and reported readiness gaps.
- Compared current external releases using USACE's official HEC download/documentation pages and USGS WDFN migration guidance. These public source findings are **not** evidence that any executable was installed, validated, or run in TSM.

## Completed in this workstream

1. **Geodesy foundation:** merged PR #399 after checks completed. The typed CRS/datum/unit and station-specific stage/elevation contracts are now on `main`.
2. **Local holdings hardening (this PR):**
   - Constrain relative data paths and resolved symlink targets to the explicitly configured data root.
   - Reject incomplete or inconsistent manifest reconciliation fields; verify actual byte length and SHA-256.
   - Preserve the source family: FEMA-derived flood-area copies map to `fema-nfhl`, USDA NRCS SSURGO archives map to `usda-soils`. Unknown authorities are not silently labeled FEMA.
   - Return a typed, byte-verified **archive descriptor** for ZIP holdings; do not interpret binary soil archives as JSON or claim their contents were parsed.
   - Mark local holdings `UNVERIFIED` after hash checks: integrity alone is not authoritative scientific or regulatory validation. This is especially important for generalized third-party NFHL copies.
   - Verify GeoJSON FeatureCollection type and manifest feature count; fail on mismatch.
   - Reject path traversal in pinned snapshot filenames and duplicate manifest entries.
   - Add regression tests exercised by the existing `government-snapshots.test.ts` contract suite.

## Status and limitations

| Domain | Existing assets | Acceptance still required |
|---|---|---|
| Government source discovery | FEMA, USGS 3DEP/WDFN, NOAA NWPS, DNR/IGIO, USDA SSURGO, USACE service registries and adapters | Source-specific acquisition receipts, verified version, county bounds, coverage, NoData, license and schema rules for each promoted artifact |
| County geometry/terrain | County boundary, mixed-county hazard copy, parcels, watershed references, DEM snapshots and 581-tile DEM discovery manifest | Per-artifact SHA-256 in deployment, independent county clipping/containment, DEM CRS/vertical semantics, NoData and AOI coverage acceptance |
| Hydraulic / sediment | USACE confluence AdH study and HEC-HMS/RAS runner/preflight contracts | Real project assets and approved model domain, bathymetry and surveyed datum, boundary condition series, documented calibration, authenticated executable/version, numerical validation, signed review |
| Geodesy | Typed CRS/datum contracts, NAVD88/gage metadata rules | Verify all source datasets, ellipsoid/geoid compatibility and epoch, grid files/versions, historical NGVD29 conversion scope, accuracy budget and production validation |
| 3D/native | Building and 3D Tiles assets, Unreal/Windows runtime and CI | Whole-county spatial coverage acceptance, transvoxel seams, GPU device matrix, installer payload, offline data license and source-hash inventory |
| Distribution | GitHub Pages and CI build paths | Verify independent deployment after every merge; Windows package success alone does not certify engineering data or solvers |
| Privacy | Public repository includes location-specific site record names and evidence | Review redaction strategy and file references; rewriting HEAD does not purge earlier Git history or external cached copies |

### Current authoritative software version observations (not installed)

- USACE HEC currently advertises **HEC-RAS 7.0.2** for Windows 10/11 64-bit; the 7.0.1 version remains available in archives: https://www.hec.usace.army.mil/software/hec-ras/download.aspx.
- USACE lists **HEC-HMS 4.14** (September 2026 documentation): https://www.hec.usace.army.mil/software/hec-hms/documentation.aspx.
- USGS identifies `https://api.waterdata.usgs.gov/ogcapi/v1/collections/latest-continuous` as the replacement for legacy `waterservices.usgs.gov/nwis/iv`: https://api.waterdata.usgs.gov/docs/ogcapi/migration/.

Do not upgrade solver version pins without testing compatibility with the actual project files, numerical outputs, and license/distribution conditions. Do not infer a NAVD88 water-surface elevation by adding station altitude to gage height.

## Prioritized follow-up acceptance queue

1. **P0 data/privacy:** classify public site identifiers and redact/pseudonymize where appropriate without losing an access-controlled chain of custody. Confirm no secrets or sensitive household details enter generated pages.
2. **P0 offline promotion:** run Posey authoritative-source receipt verifier against actual installed data and publish exact dataset coverage/byte/hash receipts; keep missing/unverified products unavailable.
3. **P0 real solver readiness:** replace placeholder candidate HMS/RAS model hashes, executable fingerprints, hydrologic outlet, drainage delineation, and terrain/boundary metadata only after authentic artifacts exist. No synthetic convergence or implied regulatory determination.
4. **P1 geospatial quality:** independently validate whether the cached county-named hazard GeoJSON includes features from multiple counties; tag the product as regional or derive a properly clipped, versioned Posey-only artifact.
5. **P1 USGS modernization:** prioritize modern Water Data v1 adapters and preserve agency observation time, parameter code, units, provisional status, station, and gage datum. Keep fallback timeouts deterministic and return explicit unavailable states.
6. **P1 solver comparisons:** validate HEC-HMS 4.14, HEC-RAS 7.0.2, MODFLOW, SWMM, and AdH only when actual licensed/supportable executables or format parsers and independent calibration fixtures are available.
7. **P2 native/offline/3D:** run whole-county mesh and LoD acceptance, hardware WebGPU tests, Windows installer smoke tests, SHA-256 asset inventory, and no-network installation replay.

## Evidence authority

USGS New Harmony inundation study and the USACE Wabash–Ohio confluence AdH investigation provide **study-specific reference evidence**. Neither implies calibration at a different site. The Indiana DNR Best Available layer cannot silently replace an effective FEMA NFIP product; FEMA BLE discovery is not a validated BLE acquisition. FEMA's 2014 conversion guidance distinguishes passive, countywide, and stream-based NGVD29/NAVD88 conversions; current guidance, geographic applicability, and transformation provenance must be checked before actual conversions.

**Operating rule:** human authority final; provenance and validated scientific computation are separate from rendering. Missing inputs produce explicit unavailable/ineligible states, not invented data.
