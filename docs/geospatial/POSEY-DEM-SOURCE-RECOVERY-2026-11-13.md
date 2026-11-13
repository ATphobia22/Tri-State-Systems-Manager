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

2020 DEM tile source prefix, as recorded by Indiana GIO's `urlpath` layer: `s3://gisimageryingov/demoptimized/statewide/2020/SPW/2.5ft/`. This imagery bucket is **distinct** from the AWS Open Data Registry LiDAR bucket `giselevationingov`; the candidate planner and verified-object acquisition must agree on the imagery bucket. Public objects `IN2020_26700930_12.tif` (15,170,693 bytes) and `IN2020_26850945_12.tif` (21,064,965 bytes) were independently HEAD-verified on Nov. 13, 2026 via AWS. **Two objects do not constitute full Posey coverage.** The matching Google Drive folder holds one of these TIFFs and a manifest listing two object hashes; it is not a certified archive.

## Altitude-mode interoperability and noninterchangeable geoid frames

Google's [3D Maps altitude modes](https://developers.google.com/maps/architecture/3d-understand-altitude-modes?hl=en) are useful **semantic references**, not a datum conversion recipe for TSM native UE or Cesium assets:

| Google 3D Maps mode | Semantic target | TSM policy |
| --- | --- | --- |
| `CLAMP_TO_GROUND` | Bare-earth terrain, ignoring the input altitude | May be used for **2D footprint/reference overlays only**; missing height remains `UNAVAILABLE` |
| `RELATIVE_TO_GROUND` | Offset above digital terrain | Only after a verified relative height and the same referenced ground model are available; never invent a default extrusion |
| `RELATIVE_TO_MESH` | Offset above visible surface, including buildings/trees | Not suitable for inferring an authoritative roof height or ground elevation; risks double-counting structure/canopy |
| `ABSOLUTE` | Google 3D Maps' EGM96 mean-sea-level altitude | **Must not** receive a TSM NAVD88/GEOID12B/GEOID18 elevation directly; verify and apply the proper vertical transformation before cross-platform rendering |

These are Google Maps semantics; TSM's explicit local terrain and model loaders require their **own tested placement contracts**. In particular, Google's EGM96 reference is *not* interchangeable with NAVD88 or an ellipsoid height. Horizontal reprojection alone cannot reconcile these Z frames. For local UE/Cesium ECEF, use the documented regional geoid relationship `h = H_NAVD88 + N` only when the precise source datum, geoid model, units, and epoch are applicable and independently verified.

### Public source registry verification

The independently fetched [AWS Open Data Registry entry](https://github.com/awslabs/open-data-registry/blob/main/datasets/in-elevation.yaml) identifies **IGIO/IOT management, CC0 licensing, bucket `arn:aws:s3:::giselevationingov`, region `us-east-2`, and the original tile lower-left-coordinate naming convention**. It also names [the state's S3 browser](https://giselevationingov.s3.amazonaws.com/index.html). Registry membership, S3 HEAD success, and a matching object size are **availability checks**, not source-file SHA-256, raster-value, feature-linkage, or vertical-transform certification.

## New authoritative IndianaMap ImageServer and real tile-footprint cross-check

The [Indiana 2016–2020 DEM catalog](https://www.indianamap.org/datasets/indiana-2016-2020-dem/about) and its [official dynamic imagery service](https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer) identify a statewide hydro-flattened **bare-earth** QL2 DEM, not building roof elevations. The service's display CRS is Web Mercator EPSG:3857; its live public properties may reflect image-service mosaic resolution and are **not** proof that source tiles share the same native resolution/vertical CRS. Hillshade, slope, and aspect functions must never be sampled as literal elevation.

An independent [Indiana GIO 2016–2020 DEM tile-footprints layer](https://gisdata.in.gov/server/rest/services/Hosted/Indiana_DEM_Tile_Footprints/FeatureServer/0) exposes `filename`, `urlpath`, `county`, and `image_year` with actual published tile polygons. **Prefer the actual exported polygons and filename keys** to the 5000-ft formula when reconciling coverage. The earlier `plan_posey_dem_recovery.py` remains a deterministic *candidate* tile plan only.

Export the authoritative layer to GeoJSON using ArcGIS FeatureServer `/0/query` with `where=county='Posey' AND image_year=2020`, `outFields=filename,urlpath,county,image_year`, `returnGeometry=true`, `outSR=4326`, `f=geojson`. Paginate or partition the result if it exceeds the service's `maxRecordCount=2000`; do not treat a truncated response as a complete tile catalog. Preserve the exact downloaded bytes and retrieval timestamp in an external acquisition receipt.

```bash
python scripts/geospatial/reconcile_posey_official_dem_tiles.py \
  --buildings /path/to/verified-posey-buildings-igio.geojson \
  --tile-footprints /path/to/official-posey-2020-dem-tile-footprints.geojson \
  --expected-buildings 23082 \
  --require-covered \
  --output /path/to/official-dem-tile-coverage.json
```

This separate audit (a) validates all 23,082 OBJECTIDs, (b) uses geographic polygon intersections **and full polygon coverage**, including multipart buildings, (c) rejects unsafe filenames and mismatched year/county, (d) emits the list of required *published* filenames, and (e) explicitly refuses to call raster values, vertical datums or heights verified. **No actual exported Tile Footprints GeoJSON has been acquired during this PR**; the numerical coverage result remains unverified.

The supplied `Indiana 2016-2020 DEM.jpg` is a 400x400 shaded-relief picture, **not** a georeferenced raster or source DEM. It may illustrate relief in a nonauthoritative legend, but cannot supply Z samples or validate CRS, cloud-optimized GeoTIFF contents or ground elevation.

## Runbook: rebuild source inventory before accepting heights

The tile planner reads **actual** authoritative footprint geometry (not a county bounding-box guess), checks every stable source identity, preserves multipart polygons, projects WGS84 source footprints into the 2020 Indiana West grid, and enumerates every intersecting 5000-foot source tile.

```bash
python scripts/geospatial/plan_posey_dem_recovery.py \
  --geojson /path/to/verified-posey-buildings-igio.geojson \
  --expected-count 23082 \
  --out /path/to/posey-2020-dem-tile-plan.json
```

The resulting `tileNames` are public S3 object *candidates*, NOT a claim that all files are present. Before use, compare each required key with the official GIO DEM `urlpath` and the separate public imagery bucket, acquire the actual raster bytes into isolated storage (Google Drive can store bulky source files), hash the files with SHA-256, and inspect each TIFF's true CRS, nodata, Z units, pixel values, and provenance. Generate `<DEM>.provenance.json` only from reviewed original source metadata; never manufacture NAVD88 sidecars just to satisfy the hash gate. For a staged directory:

```bash
python scripts/geospatial/plan_posey_dem_recovery.py \
  --geojson /path/to/verified-posey-buildings-igio.geojson \
  --staged-dem-dir /path/to/complete/dem/tiles \
  --require-complete-staging \
  --out /path/to/posey-dem-staging-audit.json
```

A complete *staging metadata* audit still does **not** validate actual footprint raster samples, native UE geometry, datum transformation, or roof-height precision. A new full acquisition/DEM sampling run plus a fresh LiDAR derivation run (with corrected MultiPolygon/hole clipping from PR #580) must produce an exact inventory. Require `23,082/23,082` accepted heights, verified datum/provenance, geometry and texture validation, packaging, and independent headed offline test before declaring that strict release gate complete. If unavailable, the partial public viewer must identify missing values explicitly.

## ImageServer TIFF acquisition defect corrected

The pre-existing `scripts/geospatial/acquire_indiana_dem_tiles.py` tested downloaded headers against double-escaped byte strings such as `b"II*\\\\x00"`, which cannot match the first four bytes of a valid ordinary TIFF. It also reused any nonempty local cache file without checking whether it was an HTML/JSON error response. This PR replaces those comparisons with explicit 4-byte integer signatures for little/big endian TIFF and BigTIFF and verifies cached files before reuse. A matched signature is only **file-type plausibility**, not raster integrity, CRS, Z-unit, datum, no-data, spatial completeness, or checksum provenance. Regression tests reject malformed/short cached responses and accept the four TIFF signatures.

## Misleading metadata corrected

The acquisition source previously set `groundElevationSource = "TSM committed Posey 3DEP-derived DEM"` even for unsampled buildings and even though runtime files need not be committed. The `posey_ground_sample.ground_elevation_fields` helper now:

- Emits **null** DEM source, method, reference and numeric elevations when no valid sample exists.
- For valid local samples, displays the specific TIFF basename, retains the actual source reference, and labels the evidence `LOCAL_SHA256_PINNED_NOT_INDEPENDENTLY_CERTIFIED`.
- Explicitly marks `groundElevationRegulatoryCertified = false`; no changes to the distinct `lidarHeightStatus` roof-height acceptance.
- Keeps the existing `elevationCoverage=UNAVAILABLE` count and warnings; no artificial success count is generated.

Do not rewrite historical evidence manifests to pretend previous runs used the fixed source; regenerate receipts from freshly acquired data with new SHA-256 references. Never erase or overwrite authoritative original source snapshots.
