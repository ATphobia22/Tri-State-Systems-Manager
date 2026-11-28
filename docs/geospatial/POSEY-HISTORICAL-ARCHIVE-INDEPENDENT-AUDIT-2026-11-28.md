# Independent Posey snapshot / historical asset archive audit — 2026-11-28 UTC

Classification: **STRUCTURAL_EVIDENCE_ONLY_NOT_PRODUCTION_ACCEPTANCE**.

This audit joins an already stored Indiana GIO Posey building-source ZIP to an older
3D Tiles archive. It does not reconstruct new geometry, recover roof heights,
verify legal permissions, prove datum conversions, or certify buildings.

## Inputs (original bytes preserved)

- Official-source capture: posey-igio-official-snapshot-2026-11-26.zip
  - SHA-256: 483fcd56eb7dd8f9f436b566439b73104bece9400e1fb37b7a58002c06b86df9
  - Internal posey-source-inventory.json SHA-256: 17aba1aa14d2b00463a41617ad82c181ca176f7ddd02ef2e501d8853df27f89e
  - Source receipt reports 23,082 Posey footprint OBJECTIDs.
  - Independently checked: 116 JSON geometry pages, 23,082 unique OBJECTIDs,
    archive CRC, inventory SHA-256 sidecar and canonical sorted-OBJECTID digest.
  - Source has no surveyed roof heights, and its recorded CRS/geometry metadata
    must not be used as vertical datum evidence.
- Existing historical asset archive: posey-fixed-part01.tar.zst
  - SHA-256: 218cc1dd334f9b2eebd33429cb14a48cebcda1ef980c16384d2dfd4f104e57f8
  - Previously uploaded archive is not re-uploaded or modified.
  - Independent full byte-stream audit: 42,837 entries; 22,320 ordinary files;
    20,517 internal symlinks resolving to existing archive files.
  - 21,235 physical GLBs pass bounded glTF 2.0 container/JSON checks.
    This is **not** GPU import validation.
  - 20,517 unique flat LOD1 GLB OBJECTIDs, all referenced by the explicit flat
    tileset; zero broken explicit flat references, zero unreferenced flat GLBs.

## Identity reconciliation

| Check | Count |
| --- | ---: |
| Fresh source footprint IDs | 23,082 |
| IDs with a matching flat historical GLB | 20,517 |
| Source IDs not represented in flat archive | **2,565** |
| Archive IDs not found in the source | 0 |

The **2,565 missing archive IDs** are NOT synonymous with 2,567 unresolved
roof/ground heights recorded in the historical #756 Building 3D Tiles CI
run. One is an identifier presence gap between two independently captured
artifacts; the other is a height-measurement evidence gap. Neither figure
establishes exactly how many new LOD2 or photorealistic LOD3 assets can be
produced.

The flat/manifest.json inside the older archive records 20,517 source
features and 11,826 OBSERVED plus 8,691 DERIVED height sources.
Those are **historical author-supplied labels, not independently verified
LiDAR measurements**. They cannot be promoted without per-ID provenance,
roof/ground measurement rechecking, legal source permissions, geodetic
transforms, and imagery.

## Reproduce offline

With Python 3.11+ and open-source zstd installed:

    python3 -m unittest discover -s tests -p 'test_audit_posey_archive.py' -v
    python3 scripts/geospatial/audit_posey_archive.py \
      --source-zip /path/to/posey-igio-official-snapshot-2026-11-26.zip \
      --tiles-tar /path/to/posey-fixed-part01.tar.zst \
      --output /path/to/posey-archive-audit.json

Exit code **2** indicates missing/extra identity coverage or broken explicit
tile references while retaining the JSON report. This is intentional; never
turn an incomplete historical archive into an accepted countywide release.
Tests cover corrupted GLB headers, safe internal symlinks, path traversal,
external symlinks, complete/incomplete identity fixtures and fail-closed CLI
behavior. CI exercises fixtures only; the real archive requires external
original bytes and is not checked into the repository.

## Blocking release evidence

- Reacquire the authoritative source independently as needed and reconfirm
  licensing, source version and feature identity.
- Preserve missing/unavailable roof and terrain data as unavailable, rather
  than substituting default/Overture heights or synthetic facades.
- Reconcile PR #696 with the existing draft replacement PR #756 and preserve
  the separate source-derived policy candidate #751.
- Perform per-ID measured COPC/LAS/DEM recovery and validate vertical datum,
  geometry, LOD integrity, Cesium headed rendering and Windows offline shipping.
- Keep Main CI and scheduled publication verification separate from
  independent scientific, engineering and regulatory reviews.

No main-branch or publishing changes are authorized by this audit alone.
