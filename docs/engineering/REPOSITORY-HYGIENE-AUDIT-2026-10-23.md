# Repository hygiene audit — 2026-10-23

## Scope and method

This is a read-only inventory of the current `main` Git tree plus a narrow, safe ignore-rule update. The recursive Git tree reports 9,368 tracked files, approximately 824,372,132 bytes (about 786 MiB) of blob content, and 8,715 unique Git blob IDs. No tracked data, generated tile, model, document, or source file was deleted or rewritten as part of this audit.

## Safe changes

- Extended root `.gitignore` for common Python test/type/lint caches, coverage output, Python package build metadata, browser-test reports, additional frontend build caches, native build outputs, resumable download fragments, and `*.flat-backup` files.
- Ignore rules do not remove already-tracked files. Existing tracked chunk files remain tracked and are used by `data/fabrics/downloads/usgs-3dep-1m/reassemble.sh`; do not delete those chunks unless the reassembled raster is independently verified and the storage migration is approved.
- Existing Node caches, `dist/`, `.vite/`, coverage, Python bytecode, temporary extensions, TypeScript build info, `.turbo/`, `.next/`, local evidence store, secrets, and terrain tile cache were already covered.

## Findings requiring owner/release review (not auto-cleaned)

1. **Tracked split-download chunks:** five files under `data/fabrics/downloads/usgs-3dep-1m/USGS_1M_16_x41y419_IN.tif.part-a*` total 257,825,774 bytes (about 246 MiB / 258 MB). The repository has a `reassemble.sh` that concatenates them. They look like staging/download artifacts, but are required by that script in the current tree; migration to Git LFS or release artifacts should be planned before removal.
2. **Tracked backup:** `tsm-console/public/3d-tiles/legacy/buildings-glb-legacy/tileset.json.flat-backup` is approximately 4.68 MB. No code-search result references the exact filename, but lack of a textual reference does not prove it is disposable. It remains in place pending validation of legacy tile consumers and rollback needs.
3. **Identical USGS PDF content at two paths:** `data-sources/downloads/usgs/sir2016-5119-report.pdf` and `data/fabrics/reports/USGS-SIR-2016-5119.pdf` have the same Git blob ID. The two paths may be used by separate source/catalog conventions; deduplicate only after reference and provenance checks.
4. **Identical GeoJSON at data/runtime paths:** `data/posey-county/reference/usgs-24k-quadrangle-boundaries.geojson` and `tsm-console/public/reference/usgs-24k-quadrangle-boundaries.geojson` are byte-identical. Similar mirrored copies exist for the USACE leveed-area GeoJSON. These may be intentional runtime-public assets; no path was removed.
5. **Duplicate-content scan is not a delete list:** the inventory found 68 repeated-blob groups. Many are expected empty Python `__init__.py` files, identical tsconfig templates, and repeated 3D Tiles subtree payloads. Binary-identical tile payloads can still be referenced at distinct spatial coordinates; deleting by hash would break tilesets.
6. **Large tracked assets:** 21 blobs exceed 10 MiB, including elevation/floodplain rasters, source PDFs, geospatial vectors, geoid grids, and generated 3D tiles. These may be operational source assets, not disposable build outputs. The repository contains both source/reference data and runtime-public tile content; moving these requires a manifest, reproducible download path, hashes, and deployment validation.
7. **Generated tile tree:** the tree includes many `.glb`, `.bin`, and `.subtree` files under `tsm-console/public/3d-tiles/`. They are large but currently part of the app's served asset tree. The existing `.gitignore` comment says generated tiles should not be committed, which conflicts with the current tracked runtime assets. Resolve by deciding whether the checked-in tiles are a supported offline fallback or should be generated/downloaded during release. No blanket ignore or deletion was applied to these paths.

## Suggested next actions

- Run a full local duplicate-reference audit across source code, manifests, tileset JSON, catalog JSON, and deployment packaging before deduplicating any tracked assets.
- Reassemble and hash-compare the 1 m DEM before moving its chunks out of Git.
- Validate the legacy tileset backup against current tileset JSON and historical deployment rollback requirements.
- Decide on a versioned data-artifact strategy (Git LFS, release assets, object storage, or deterministic CI acquisition) for large authoritative source data.
- Run repository integrity, TypeScript, Python, geospatial, frontend build, and deployment checks on the hygiene branch before merge. This audit does not claim those checks passed.
