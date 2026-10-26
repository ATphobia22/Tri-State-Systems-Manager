# Countywide building heights: persistent failure evidence

The historical production Building 3D Tiles run
[40262995508](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/40262995508)
failed at the 23,082/23,082 LiDAR height gate on 2026-10-26:

| Source | 2026-10-26 count | Provenance |
| --- | ---: | --- |
| Class 6 OBSERVED EPT | 11,821 | LiDAR returns |
| Class 1 DERIVED 2020 COPC | 8,696 | LiDAR-derived within footprint |
| UNAVAILABLE | 2,565 | **No accepted measurement** |
| Total source IDs | 23,082 | IGIO identity inventory |

All 446 COPC tiles finished without tile failure; the 2020 derived extraction
used about 4h 53m. There were 29 footprints without DEM samples in the
acquisition run. The prior published mesh inventory had 267 missing OBJECTIDs.
The 267 published-mesh ID gaps, 2,565 unavailable LiDAR heights, 29 terrain
sample gaps, and 12 invalid polygons in the separate uploaded IGIO candidate
are **different evidence sets**, not interchangeable counts.

## Diagnostic contract

The **coordinate-redacted** \`emit_building_height_gap_evidence.py\` command
collects every source OBJECTID with missing LiDAR height or unresolved DEM
coverage, groups failures into a *closed enum*, pins input files by SHA-256,
and cross-references the last published footprint-identity delta. Its output
contains **no geometry, longitude/latitude, address, ownership, raw status
message, roof elevation, or other sensitive property**.

The full merged COPC GeoJSON, LiDAR points, and private inputs remain on
private runners/caches only; do **not** publish these inputs in a public
GitHub release or documentation.

The production \`building-3d-tiles.yml\` workflow should always upload this
receipt after extraction, **before** its strict 23,082-height acceptance gate.
The receipt is diagnostics, never a build bypass, and its presence does not
certify measured heights, NAVD88 transformations, or generated 3D Tiles.

Run locally after height extraction:

    python3 scripts/geospatial/emit_building_height_gap_evidence.py \
      --geojson /private/posey-buildings-height-merged.geojson \
      --identity-delta /private/building-objectid-source-delta.json \
      --expected-count 23082 \
      --out /private/building-height-gap-evidence.json

The output sidecar \`.json.sha256\` verifies the generated receipt.

## Recovery hierarchy

1. For \`NO_LIDAR_RETURNS_NEAR_FOOTPRINT\` and \`INSUFFICIENT_GROUND_RETURNS\`,
   verify COPC spatial extent, tile boundary intersections, Class 2 density,
   and authoritative terrain coverage; record which tiles were tested.
2. For \`INSUFFICIENT_ROOF_RETURNS\`, test additional genuinely classified
   roof points and alternate authoritative LiDAR vintages. Do **not** use
   arbitrary story-height multipliers.
3. For \`ROOF_RETURNS_TREE_CONFOUNDED\`, explicitly classify canopy-contaminated
   samples and prefer independently verified building returns.
4. Cross-check USACE NSI 2026 \`bldheight\` / \`ground_elv\` fields only as
   *modeled exposure QA*. These are not equivalent to measured COPC/3DEP
   returns and cannot satisfy an OBSERVED/DERIVED LiDAR gate.
5. For DEM gaps, inspect raster bounds, nodata, vertical datum and source
   vintage. Do not convert an unknown vertical reference into NAVD88.
6. Re-run geometry and topology validators; emit one valid source-bound GLB
   per accepted IGIO OBJECTID, then full OGC 3D Tiles 1.1 validation and
   hashes before calling countywide acceptance complete.

Maintain the user-facing *informational-only* partial viewer when the strict
production acceptance gate is unsatisfied. Track remaining obligations in
[issue #416](https://github.com/ATphobia22/Tri-State-Systems-Manager/issues/416).
