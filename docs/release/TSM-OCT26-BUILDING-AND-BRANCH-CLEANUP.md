# TSM 2026-10-26 release/branch housekeeping record

**Data scope:** public release metadata, no site-address or personally identifiable records. **Status:** incomplete countywide OGC 3D Tiles acceptance. Do not infer full release quality from unrelated green CI workflows.

## Latest measured countywide building evidence

2026-10-26 historical failed full LiDAR acceptance run [40262995508](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40262995508):

| Validation stage | Evidence | Release disposition |
|---|---|---|
| IGIO source identities | 23,082 unique footprint OBJECTIDs | Acquired identity inventory, not 23,082 valid GLBs |
| LiDAR height OBSERVED | 11,821 | Source-linked observed subset only |
| LiDAR height DERIVED | 8,696 | Source-linked derived subset only |
| LiDAR height UNAVAILABLE | 2,565 | Explicit unresolved footprint IDs required |
| DEM missing ground samples | 29 | Must be reconciled; distinct from missing heights |
| IGIO uploaded candidate invalid polygon topology | 12 | Distinct candidate source snapshot; independently verify authoritative vintage |
| Historical published 3D geometry gap | 267 missing identities | Distinct prior tileset release, not equivalent to height gaps |

**Required for acceptance:** exact authoritative current-source count/identity reconciliation; valid topology; per-object traceable roof/ground evidence; horizontal and vertical CRS/datum/unit preservation; all-source 23,082 valid GLBs; audited LOD1/LOD2 outcomes; 3D Tiles 1.1/GLB/Draco/HLOD/feature linkage and spatial coherence; deterministic hashes and round-trip offline Windows packaging. A successful syntax/Pages/Windows build alone cannot attest these deliverables.

Partial informational viewers should remain functional, with clear `INFORMATIONAL_ONLY`, `SOURCE_UNAVAILABLE` and `STALE` states. Simulations must not silently issue FEMA determinations. Owner/public address and insurance identifiers must not be added from newly uploaded private documents.

## Verified cleanup

- PR #443 merged: preserve COPC checkpoint even when the hard height gate fails; workflow-file edits do not automatically restart ~5 h extraction.
- PR #444 merged: source-linked nDHM review-only QA, government-source catalog, source-host inventory and tests.
- PR #445 closed as duplicate of #444, not merged.
- PR #442 merged earlier: Indiana elevation catalog, sample nDHM metadata and source availability contract.
- PR #446: 446 2020 COPC tile-grid index from the failed run with public S3 alternatives; merge only after its checks pass.
- PR #447: speed up 2,565-geometry nDHM QA via source-spatial index/hash caching; remove names of source files from public-host audit; merge only after its checks pass.
- Issue #416 remains open for **actual** acceptance.

## Safe remote branch-pruning candidates (checked against main, 2026-10-26)

These refs were verified as `ahead_by=0` versus main by the GitHub Compare API. Their commits are already reachable from main and they contain no unique ahead commits **at this point in time**.

- `feat/mapbox-posey-building-height-qa-20261026`
- `feat/optim3d-cityjson-objectid-reconciliation-20261026`
- `feature/data-fabric-hardening-gates`
- `feature/posey-government-evidence-gates-20261024`
- `fix/ras-wse-comparison-alignment-evidence-20261025`
- `fix/transvoxel-coarse-scalar-correctness-20261023`

**Do not delete** a diverged/unmerged branch on name or age alone. Re-run branch Compare API before deleting; confirm no open PR uses the ref, that it is not protected and that `ahead_by=0`. This connector has no branch-deletion action, so no historical refs are represented as deleted here. GitHub's automatic head-branch deletion is already configured for **merged PRs**, but does not necessarily remove historical orphan refs.

## Actual source QA versus construction-ready data

Official Indiana S3 nDHM sample `IN2020_26850945_12_ndhm.tif`: float32, 5ft raster spacing, band label US survey foot, NAVD88/Geoid12B in the *compound* source WKT with NAD83(HARN) Indiana West horizontal realization; 65,536 inspected samples included 2,152 negative pixel values; EPSG authority not automatically resolved and nodata not declared. This is **candidate** above-ground imagery and not a survey/roof. The spatially indexed QA emits private review receipts only.

Official government-source inventory includes FEMA effective mapping, USACE/HEC regulatory and navigation references, NOAA/NGS, USGS/3DEP/3DHP, Indiana DNR/IGIO, USFWS wetland discovery, USDA SSURGO, and public Census boundaries. Each layer requires source vintage, license, SHA, authority and coverage validation before runtime promotion.

## Merge hygiene

Use pinned GitHub Action SHAs, least-privilege workflow tokens, no secrets in public workflow logs, no raw source GeoJSON/point clouds or policy scans in public Actions artifact uploads, bounded S3 HEAD discovery and dedicated source-hash manifests. Keep native Windows runtime verification distinct from the Web Pages preview.
