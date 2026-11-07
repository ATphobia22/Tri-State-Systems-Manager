# Implicit glTF format repair — 2026-11-07

Source main: `ba0657896c95ce6a20fa74cb821a0637ddedcadf`.

Independent Cesium `3d-tiles-validator@0.6.1` inspection of the public root followed its external implicit tileset and found invalid `UNSIGNED_INT` feature vertex attributes and a structural metadata schema ID containing hyphens. External tilesets themselves are permitted; the older explicit-only project validator cannot accept that root layout.

The writer now encodes local row indices as exact FLOAT values (rejecting indices beyond 2**24), and uses a valid schema ID. OBJECTID property-table storage remains UINT32. The linkage validator decodes FLOAT indices and rejects fractional, nonfinite, negative and out-of-table values.

`repair_implicit_feature_ids.py` copies a published implicit tileset into a new output directory, corrects those two format defects, and records before/after SHA-256 values for every GLB. It does not change geometry, measured heights, placement transforms or source OBJECTID values. It refuses unsupported layouts and shared feature bufferViews rather than guessing.

## Candidate receipt

- 718 GLBs repaired; 20,517 distinct OBJECTIDs; zero project linkage violations.
- Cesium 0.6.1: **0 errors, 0 warnings, 718 information groups**. Notices include unsupported glTF extension checks, so this is not exhaustive extension conformance certification.
- Seven implicit builder tests and one repair regression test pass. Regression covers binary geometry/source-ID preservation, idempotence and invalid FLOAT index rejection.
- [Repaired candidate and receipts](https://chatgpt.com/library?file_id=libfile_c858ec8777e08191b296c6c1452c5bb3&account_id=personal), ZIP SHA-256 `7036faafb43ae77d63f07f0294c968e30c41b736cbc755203b92e6d7b4ccd3bd`.

The candidate is saved separately; **published repository GLBs are unchanged**. Replacing production content requires a reviewed publication and new package checksums. This candidate does not fill 2,565 height-evidence gaps, establish original source vintage or validate NAVD88/ECEF transformations, full 23,082 identities, a headed renderer, UE Shipping or regulatory authority.

## Reproduce

```bash
python3 scripts/geospatial/repair_implicit_feature_ids.py \
  --input-dir tsm-console/public/3d-tiles/buildings-lidar-12450 \
  --output-dir /tmp/tsm-implicit-repaired
# Use an installed pinned Cesium validator; this tool must follow external/implicit content.
3d-tiles-validator --tilesetFile /tmp/tsm-implicit-repaired/tileset.json \
  --reportFile /tmp/tsm-implicit-report.json
python3 -m unittest discover -s scripts/geospatial -p test_build_implicit_tileset.py
python3 -m unittest discover -s scripts/geospatial -p test_repair_implicit_feature_ids.py
```
