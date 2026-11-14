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


## November 13, 2026 observed acceptance (run 43386782972)

The latest reviewed build completed all COPC downloads and retained the
**23,082 source-footprint identities**, but its strict production gate failed:

| Evidence state | Count |
| --- | ---: |
| OBSERVED from 3DEP EPT Class 6 | 11,823 |
| DERIVED from Indiana 2020 COPC Class 1 | 8,693 |
| UNAVAILABLE | **2,566** |
| Source identities | **23,082** |

The private, hash-pinned gap receipt classifies the 2,566 unavailable heights:

- 2,269 ROOF_RETURNS_TREE_CONFOUNDED
- 273 INSUFFICIENT_GROUND_RETURNS
- 24 INSUFFICIENT_ROOF_RETURNS

**Separate terrain evidence:** this run's gap receipt reported only 246
DEM_SAMPLED and 22,836 DEM_UNAVAILABLE entries; this is NOT a declaration
that all these parcels lack terrain in the real world. Review footprint DEM
sampling and raster AOI CRS, nodata and source coverage independently.

This change corrects a genuine COPC footprint clipping defect: the prior
code used only one exterior ring of a MultiPolygon (selected by vertex count,
not area), and ignored all interior holes. That could make detached roofs
unavailable or include canopy within an excluded courtyard. The new
get_footprint_polygons_spw preserves all parts, excludes holes and rejects
nonfinite WGS84 input, without modifying confidence thresholds or accepting
synthetic heights. The change requires a **fresh derived-extraction checkpoint**
because the source script hash is intentionally pinned in the checkpoint.

**This is a geometric correctness repair, not evidence of recovered heights.**
Neither the remaining 2,566 nor the DEM coverage gap can be marked resolved
until the rerun produces an exact per-OBJECTID source-linked record with a
verified source hash and the original hard gate passes. A successful footprint
join by itself never establishes roof geometry/height validity.

See: [Building 3D Tiles failed run 43386782972](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43386782972)
and the tsm-building-height-gap-evidence-43386782972 artifact.

## Adjacent 2020 COPC tiles

The primary extraction considers one tile per footprint. A subsequent pass
now retries unresolved footprints whenever a multipart roof or its 50-foot
ground search crosses a tile edge. It includes diagonal neighbors, checks
Indiana West and NAVD88 US survey foot CRS metadata, uses half-open grid cells
to assign overlapping returns once, and records each source tile's SHA-256.
Each retry uses the original roof and ground point thresholds, with courtyard
holes excluded. Incomplete windows retain their unresolved status. The production
workflow runs this pass before it writes the height-gap receipt or checks the
required 23,082 heights.

The input to the retry must be the merged point-height GeoJSON. Run with a
new tile directory, distinct output and receipt. The receipt identifies the
compared GeoJSON files by hash and includes any missing source tile URLs.
