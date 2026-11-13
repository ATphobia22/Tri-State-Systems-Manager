# Posey 2020 Elevation Recovery — evidence-led rebuild (2026-11-13)

## Decision

Preserve all **23,082** authoritative Indiana GIO building OBJECTIDs and their original footprint geometry. Do **not** treat the current partial LiDAR-height data, partial county DEM, NDHM canopy pixels, or an arbitrary default extrusion as complete verified building models. No source record is deleted; unverified measurements remain unavailable until per-OBJECTID data and tile-level datum checks justify them.

The inspected [Building 3D Tiles failure (run 43386782972)](https://github.com/ATphobia22/Tri-State-Systems-Manager/actions/runs/43386782972) reported:

| Class | Count |
| --- | ---: |
| OBSERVED (USGS EPT Class 6) | 11,823 |
| DERIVED (IGIO 2020 COPC Class 1) | 8,693 |
| UNAVAILABLE (height) | 2,566 |
| DEM_SAMPLED | 246 |
| DEM_UNAVAILABLE | 22,836 |
| Unique source footprints | 23,082 |

Missing heights: 2,269 tree-confounded, 273 insufficient ground, 24 insufficient roof returns (from the run's persisted height-gap evidence). This is **not** proof that the terrain or point clouds are absent; it is a record of what the pipeline could validate.

## Official sources and independent reference frames

- [Indiana 2016–2020 elevation catalog](https://gis.iu.edu/s/isdp/page/20162020elevation): 2020 source includes Posey County; QL2 bare-earth DEM and classified LiDAR are different products.
- [NOAA InPort 69202](https://www.fisheries.noaa.gov/inport/item/69202): western Indiana LiDAR, NAD83(HARN) / Indiana West (US survey feet), NAVD88/GEOID12B (US survey feet).
- [Indiana Statewide Elevation S3 registry](https://registry.opendata.aws/in-elevation/): public bucket `giselevationingov`, region `us-east-2`, CC0, anonymous listing.
- [Indiana GIO elevation access](https://elevation.gio.in.gov/pages/access): classified point clouds and DEM/DSM/NDHM, with different strengths and canopy confounders.

2020 DEM source prefix: `s3://giselevationingov/demoptimized/statewide/2020/SPW/2.5ft/`. Public objects `IN2020_26700930_12.tif` (15,170,693 bytes) and `IN2020_26850945_12.tif` (21,064,965 bytes) were independently HEAD-verified on Nov. 13, 2026 via AWS. **Two objects do not constitute full Posey coverage.** The matching Google Drive folder holds one of these TIFFs and a manifest listing two object hashes; it is not a certified archive.

## Runbook: rebuild source inventory before accepting heights

The tile planner reads **actual** authoritative footprint geometry (not a county bounding-box guess), checks every stable source identity, preserves multipart polygons, projects WGS84 source footprints into the 2020 Indiana West grid, and enumerates every intersecting 5000-foot source tile.

```bash
python scripts/geospatial/plan_posey_dem_recovery.py \
  --geojson /path/to/verified-posey-buildings-igio.geojson \
  --expected-count 23082 \
  --out /path/to/posey-2020-dem-tile-plan.json
```

The resulting `tileNames` are public S3 object *candidates*, NOT a claim that all files are present. Before use, compare each required key with the public bucket, acquire the actual raster bytes into isolated storage (Google Drive can store bulky source files), hash the files with SHA-256, and inspect each TIFF's true CRS, nodata, Z units, pixel values, and provenance. Generate `<DEM>.provenance.json` only from reviewed original source metadata; never manufacture NAVD88 sidecars just to satisfy the hash gate. For a staged directory:

```bash
python scripts/geospatial/plan_posey_dem_recovery.py \
  --geojson /path/to/verified-posey-buildings-igio.geojson \
  --staged-dem-dir /path/to/complete/dem/tiles \
  --require-complete-staging \
  --out /path/to/posey-dem-staging-audit.json
```

A complete *staging metadata* audit still does **not** validate actual footprint raster samples, native UE geometry, datum transformation, or roof-height precision. A new full acquisition/DEM sampling run plus a fresh LiDAR derivation run (with corrected MultiPolygon/hole clipping from PR #580) must produce an exact inventory. Require `23,082/23,082` accepted heights, verified datum/provenance, geometry and texture validation, packaging, and independent headed offline test before declaring that strict release gate complete. If unavailable, the partial public viewer must identify missing values explicitly.

## Misleading metadata corrected

The acquisition source previously set `groundElevationSource = "TSM committed Posey 3DEP-derived DEM"` even for unsampled buildings and even though runtime files need not be committed. The `posey_ground_sample.ground_elevation_fields` helper now:

- Emits **null** DEM source, method, reference and numeric elevations when no valid sample exists.
- For valid local samples, displays the specific TIFF basename, retains the actual source reference, and labels the evidence `LOCAL_SHA256_PINNED_NOT_INDEPENDENTLY_CERTIFIED`.
- Explicitly marks `groundElevationRegulatoryCertified = false`; no changes to the distinct `lidarHeightStatus` roof-height acceptance.
- Keeps the existing `elevationCoverage=UNAVAILABLE` count and warnings; no artificial success count is generated.

Do not rewrite historical evidence manifests to pretend previous runs used the fixed source; regenerate receipts from freshly acquired data with new SHA-256 references. Never erase or overwrite authoritative original source snapshots.
