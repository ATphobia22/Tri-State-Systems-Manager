# TSM Geodetic Evidence Router — DoWORC Mathematical Adapter

**2026-11-20 | Python headless prototype | Offline-first | Evidence gates enforced**

A deterministic translator and mathematical-analysis engine for the Tri-State Systems Manager. Works with original Indiana DNR hydrogeology archives, but never re-labels a source datum, silently uses a ballpark NAD27 shift, or treats GIS-derived aquifer elevations as verified NAVD88 water-surface elevations.

## Architecture

```text
Immutable private Google Drive DNR original ZIP bundle
       |
       v
ZIP CRC + SHA256 receipt -> individual .shp/.prj CRS and units census
       |
       v
Strict PROJ transformation selection (no ballpark)
       |                    |
  26916 -> 2966        26716 -> 2966
     available            grid required
       |                    |
       v                    v
GeoJSON 2D derivative  -> QUARANTINE if grid absent
       |
       v
Independent NGS control residuals + uncertainty propagation
       |
       v
SQLite append-only correction history / SHA-256 chain
       |
       +--> local JSON-lines command stream (stdin/stdout)
       +--> content-addressed on-disk event outbox
       +--> opt-in Redis Streams metadata-only bridge (never default)
       |
       v
Visualization with warnings / Review / Quarantine
       |
       v
Engineering review READY only with verified vertical datum, units,
independent controls, source integrity, licensing, and human approval
```

## Software

Python 3.11+; `pip install pyproj pyshp rasterio`; optional Redis bridge: `pip install redis`. Runtime is headless with no browser, WebView, or required remote services. Offline Windows 11 may use a pinned Python interpreter and the OSGeo PROJ runtime. Original ZIP archives stay outside the repository and outside any Redis payload.

## First run

```bash
# Re-run source inventory using the private original 16.8 MB DNR source bundle
python scripts/geo/tsm_geodetic_adapter.py inspect \
  --bundle /private/IN-DNR-DoWORC-Four-County-Hydrogeology-Originals-2026-11-19.zip \
  --output /private/native-crs-inventory.json

# Horizontal EPSG:26916 -> EPSG:2966, without touching vertical properties
python scripts/geo/tsm_geodetic_adapter.py transform-point --src-epsg 26916 440000 4200000

# NAD27 -> target safely BLOCKS without verified NADCON5 grid
python scripts/geo/tsm_geodetic_adapter.py transform-point --src-epsg 26716 440000 4200000

# Geometric uncertainty, output covariance units in metres
python scripts/geo/tsm_geodetic_adapter.py covariance --src-epsg 26916 \
  --x 440000 --y 4200000 --sigma-x-m 1 --sigma-y-m 1

# Provide a 2D FeatureCollection with known source horizontal EPSG
python scripts/geo/tsm_geodetic_adapter.py derive-geojson --src-epsg 26916 \
  --input /private/source-2d.geojson --output /private/derived-2d.geojson

# Content-addressed local route, no network
python scripts/geo/tsm_geodetic_adapter.py enqueue --manifest examples/unknown-vertical-manifest.json \
  --to engineering --outbox /private/tsm-outbox --layer posey-psm

# JSON-lines IPC (send one JSON command per line; no sockets)
cat examples/ipc-requests.jsonl | python scripts/geo/tsm_geodetic_adapter.py stdio

# Append-only edits with a tamper-evident chain
python scripts/geo/tsm_geodetic_adapter.py correct --manifest examples/unknown-vertical-manifest.json \
  --ledger /private/tsm-evidence.sqlite3 --layer posey-psm
python scripts/geo/tsm_geodetic_adapter.py verify-ledger --ledger /private/tsm-evidence.sqlite3

# Run all tests (integration test uses a private bundle only if path supplied)
TSM_DOWORC_SOURCE_BUNDLE=/private/IN-DNR-DoWORC-Four-County-Hydrogeology-Originals-2026-11-19.zip \
  python -m unittest discover -s tests -v
```

## Obtain the original NADCON5 grid

Source: [PROJ/NOAA datum grid](https://cdn.proj.org/us_noaa_nadcon5_nad27_nad83_1986_conus.tif); the [public-domain provenance record](https://cdn.proj.org/us_noaa_README.txt) identifies NOAA NADCON5 CONUS NAD27→NAD83(1986) as its originating source. See [NOAA/National Geodetic Survey NADCON5](https://geodesy.noaa.gov/NADCON5/index.shtml).

```bash
python scripts/geo/tsm_geodetic_adapter.py grid-fetch \
  --output /private/grids/us_noaa_nadcon5_nad27_nad83_1986_conus.tif
python scripts/geo/tsm_geodetic_adapter.py grid-verify \
  --file /private/grids/us_noaa_nadcon5_nad27_nad83_1986_conus.tif
# After independently obtaining the official grid hash and checking source,
# install only the SHA-pinned grid:
python scripts/geo/tsm_geodetic_adapter.py grid-install \
  --file /private/grids/us_noaa_nadcon5_nad27_nad83_1986_conus.tif \
  --directory /private/proj-grids --sha256 <trusted-sha256>
```

**Current environment:** the grid URL is confirmed, but direct network acquisition was blocked in the work runtime. SHA-256 of the grid is **not claimed**; numerical NAD27 transformations are not yet demonstrated. The adapter never approves the grid from its URL or TIFF format alone. The grid uses the NOAA NADCON5 horizontal datum model; do not confuse it with GEOID18, a vertical geoid model.

## Vanderburgh projection evidence

`tr_van.shp` in `vanderburgh_shapefiles.zip` lacks a `.prj`. The aquifer ZIP includes other NAD27/UTM 16N layers, while a later potentiometric ZIP includes `TR_Vanderburgh.prj` in NAD83/UTM 16N; the layers also have different coordinates/feature counts. Neither is authoritative proof of the missing `tr_van.shp` source CRS. Preserve its state as `SOURCE_CRS_UNKNOWN` until original DNR metadata, archival GIS project or signed agency declaration is obtained. Do **not** borrow its neighbor's EPSG, change the `.prj` in place, or promote the feature.

## Vertical water-level evidence

DNR potentiometric map metadata lists 10-foot contour intervals and source horizontal EPSG:26916. This does **not** verify a contour's NGVD29/NAVD88 reference, observation epoch, static water elevation at a point, or temporal comparability. DNR [potentiometric overview](https://www.in.gov/dnr/water/ground-water-wells/assessment-maps-and-publications/potentiometric-surface-mapping-148000/) describes water-level mapping, not FEMA BFE. Distinguish it from the Indiana DNR **flood-elevation** product, whose official webpage specifically states NAVD88 for *that different layer* (https://www.in.gov/dnr/water/surface-water/indiana-floodplain-mapping/the-indiana-best-available-floodplain-mapping/). No inferred vertical-datum shift is allowed.

## Independent surveyed controls

For `controls` pass a JSON array of **3+ independent published positions for identical NGS permanent survey marks**, in both source and target reference frames, with matching epochs/realizations, NGS PID and official NGS datasheet URLs. Each record requires: `id`, `ngs_pid`, `source_url`, `source_frame`, `source_epoch`, `target_frame`, `target_epoch`, `independent_observation:true`, `source_x`, `source_y`, `target_x`, and `target_y`. The CLI computes the planimetric east/north residual, horizontal RMSE, maximum error, and a user-selected acceptance threshold. It cannot certify that submitted control coordinates are genuine; authority review of original mark datasheets is mandatory. The code rejects *synthetic* forward/back round trips and county-centroid approximations as independent control.

Official control discovery: [NOAA NGS Survey Marks](https://geodesy.noaa.gov/datasheets/) and [NGS Data Explorer API](https://ngs.noaa.gov/web_services/data-explorer.shtml). No vetted matched source/target monument-coordinate pairs are included in this release.

## IPC and routing contracts

`stdio` accepts one JSON object per line with `op: "check" | "transform" | "route"`. Response is one JSON object per line. Read/derive operations never modify original ZIPs. Corrections create new SQLite event records; `verify-ledger` recomputes chained hashes to detect record edits. Writes to local event outbox are content-addressed and append-only. Routing is governed by `source_crs`, strict transform availability, vertical datum and units, independent control check, licensing review, source integrity and explicit human approval. Even a fully eligible payload is only `ENGINEERING_REVIEW_READY`, not an agency decision.

Optional `tsm_geodetic_redis_bridge.py` sends **metadata-only** receipts to Redis Stream `tsm:geodetic:v1:evidence-events`. It requires `--allow-network` and the environment variable `TSM_GEO_REDIS_URL`, and is **not used** by default for offline desktop installations. Stream receipts never include original geometry, zipped source archives, or full manifests.

## Remaining engineering release blockers

- NADCON5 grid must be acquired, SHA-pinned, and the selected EPSG operation replayed and documented for all 55 NAD27 layers.
- Missing `tr_van.shp` projection must be established from a responsible source, not an inferred neighboring layer.
- All required vertical reference frames and units must be verified from each DNR source, and any NGVD29/NAVD88 conversion must have an explicit 3D operation and geoid model provenance.
- Independent NGS survey-control pairs must be acquired, checked for epoch/realization consistency, and residuals approved; 8 county-polygon checks are *only geographic plausibility tests*.
- CI on the exact pull-request head and a qualified reviewer must approve; the existence of an adapter is not a release proof.

## Security and licensing

Source originals remain privately stored on Google Drive; only checksums, layer manifests, code and small derived evidence may be committed. The public-domain NOAA/PROJ grid has a different license from underlying DNR GIS downloads. Network transmissions are opt-in, and secrets must never enter the repository or Redis stream values.
