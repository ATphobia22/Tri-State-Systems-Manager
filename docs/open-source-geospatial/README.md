# Open-Source Geospatial Stack for TSM

**Tested:** 2026-10-23 | **All tools:** open source, no password/account required

This directory contains working code examples and documentation for open-source
geospatial tools evaluated for Tri-State Systems Manager integration.

## Priority 1: PMTiles Workflow ✅ WORKING

**Location:** `../pmtiles-workflow/` (full docs) + `geojson_to_pmtiles.py` (this dir)

Single-file tile archives for USB-deployable offline maps. Converts GeoJSON → MVT → PMTiles v3.

**What works:**
- `pmtiles` Python library v3.8.1 — read/write PMTiles v3 archives
- `mapbox-vector-tile` — pure-Python MVT encoder
- `geojson_to_pmtiles.py` — working converter (5 features → 3 tiles → 788 bytes)
- Round-trip verified: all features decode correctly

**TSM integration:** Serve `.pmtiles` files from USB/local disk, load directly in MapLibre GL JS
via the `pmtiles://` protocol. No tile server needed.

**See:** `../pmtiles-workflow/README.md` for full documentation.

## Priority 2: Turf.js Client-Side Spatial Analysis ✅ WORKING

**File:** `turf-flood-demo.html` — open in any browser

Client-side flood analysis running entirely in the browser. No server required.

**Verified working (Turf.js v7 via jsDelivr CDN):**
| Function | TSM Use Case | Test Result |
|----------|--------------|-------------|
| `turf.buffer()` | Flood risk buffer zones around Zone AE | 500m buffer = 7.456 km² ✅ |
| `turf.distance()` | Gauge-to-site distances | 32.11 km to New Harmony ✅ |
| `turf.booleanPointInPolygon()` | Is property in flood zone? | Anchor = true ✅ |
| `turf.booleanIntersects()` | Does building overlap flood zone? | true ✅ |
| `turf.area()` | Flood zone area calculation | Working ✅ |
| `turf.centroid()` | Zone center for map labels | -88.0050, 37.8450 ✅ |

**CDN (no account needed):**
```html
<script src="https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js"></script>
```

**TSM integration:** Add flood buffer analysis directly to the dashboard. Users can draw a
polygon and instantly see buffer zones, intersections, and distances — all client-side.

**Useful Turf.js modules for TSM:**
- `@turf/buffer` — flood risk zones, setback distances
- `@turf/intersect` / `@turf/boolean-intersects` — overlap detection
- `@turf/distance` / `@turf/nearest-point` — nearest gauge/facility
- `@turf/area` — acreage calculations for grant applications
- `@turf/hex-grid` — hexagonal binning for flood risk mapping
- `@turf/isobands` — contour lines from elevation rasters

## Priority 3: System Tools — Research Results

### WhiteboxTools ✅ WORKING (Python package, no account)

```bash
pip install whitebox  # Downloads binary automatically on first use
```

**Verified:**
- Version 2.4.0 binary downloaded and runs without account
- `slope()` — computed slope from test DEM in 0.31s ✅
- `fill_depressions()` — hydrological conditioning in 0.6s ✅

**TSM use cases:**
- `slope()` / `aspect()` — terrain analysis for flood modeling
- `fill_depressions()` → `d8_flow_accumulation()` → `extract_streams()` — watershed delineation
- `wetness_index()` — topographic wetness for flood susceptibility

**Note:** Binary downloads from whiteboxgeo.com on first use (~50MB). After that, fully offline.

### GDAL ❌ NOT INSTALLED

GDAL is not installed on this VM and was not installed as part of this task
(requires system packages / compilation). The `pyproj` Python package (v3.8.0) is
available and provides PROJ coordinate transformations.

**Workaround:** `pyproj` covers CRS/datum transformations. For raster I/O,
WhiteboxTools handles GeoTIFF reading/writing.

### PROJ (via pyproj) ✅ AVAILABLE

`pyproj` v3.8.0 is installed system-wide. Provides:
- CRS definitions and transformations
- Datum shifts (including NAD83 ↔ WGS84)
- Geoid calculations (if geoid grids available)

```python
from pyproj import CRS, Transformer
# WGS84 lon/lat to Indiana State Plane West (feet)
transformer = Transformer.from_crs("EPSG:4326", "EPSG:2968", always_xy=True)
x, y = transformer.transform(-88.005075, 37.845887)
```

### H3 (Uber's Hexagonal Index) ✅ AVAILABLE

`h3` v4.5.0 is installed system-wide.

**Verified:**
- `h3.latlng_to_cell(37.845887, -88.005075, 8)` → `88266a4021fffff` ✅
- `h3.grid_disk()` — neighbor cells for flood spread modeling ✅
- Res 8 cells ≈ 0.737 km² — good granularity for flood risk mapping ✅

**TSM use cases:**
- Aggregate flood risk scores into hex cells
- Fast spatial joins across multi-source data
- Neighbor analysis for flood propagation modeling

### tippecanoe ❌ NOT INSTALLED

tippecanoe requires building from source (C++). Not installed in this task.
The pure-Python `geojson_to_pmtiles.py` provides basic functionality without it.

For production tile generation:
```bash
git clone https://github.com/felt/tippecanoe.git
cd tippecanoe && make -j && sudo make install
```

## Summary: What's Ready for TSM Integration

| Tool | Status | TSM Integration Path |
|------|--------|---------------------|
| **PMTiles** | ✅ Working | Serve `.pmtiles` from USB/static hosting, load in MapLibre |
| **Turf.js** | ✅ Working | Add to dashboard for client-side flood analysis |
| **WhiteboxTools** | ✅ Working | Python backend for terrain/hydrological analysis |
| **pyproj** | ✅ Available | CRS transformations in Python backend |
| **H3** | ✅ Available | Hex-grid flood risk aggregation |
| **GDAL** | ❌ Not installed | Use WhiteboxTools + pyproj as workaround |
| **tippecanoe** | ❌ Not installed | Pure-Python converter works for demos |

## Files in This Directory

| File | Description |
|------|-------------|
| `README.md` | This documentation |
| `geojson_to_pmtiles.py` | Working GeoJSON → PMTiles converter |
| `tsm-sample.geojson` | Demo input (5 TSM features) |
| `tsm-demo.pmtiles` | Demo output (verified, 788 bytes) |
| `turf-flood-demo.html` | Interactive Turf.js flood analysis demo |
| `venv/` | Python virtualenv (pmtiles, whitebox, mapbox-vector-tile) |

## No Account Required

Every tool documented here is open source and works without any password, API key,
or account registration:
- PMTiles: MIT license, https://github.com/protomaps/pmtiles
- Turf.js: MIT license, https://github.com/Turfjs/turf
- WhiteboxTools: MIT license, https://github.com/jblindsay/whitebox-tools
- H3: Apache-2.0, https://github.com/uber/h3
- pyproj: MIT license, https://github.com/pyproj4/pyproj
