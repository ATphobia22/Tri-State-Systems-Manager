# Quantized-mesh terrain from USGS 3DEP (self-hosted, no ion)

Quantized-mesh is the CesiumJS terrain standard. This document describes how to
build a self-hosted quantized-mesh tileset from the USGS 3DEP DEM already used
by the Terrain-RGB pipeline — no Cesium ion, no MapTiler API keys, no
token-gated services.

## Why two terrain paths?

| Path | Format | Served from | Used when |
|------|--------|-------------|-----------|
| Quantized-mesh (preferred) | `terrain` via `CesiumTerrainProvider` | `3d-tiles/terrain-quantized-mesh/layer.json` | `layer.json` probes OK — real terrain mesh with LOD |
| GLB fallback | OGC 3D Tiles 1.1 `tileset.json` | `3d-tiles/terrain-3dep/tileset.json` | quantized-mesh absent — `CesiumGlobeView` falls back automatically |

`CesiumGlobeView` probes `layer.json` first and only uses the GLB tileset when
quantized-mesh is unavailable. Both paths carry the same provenance label
(DERIVED — USGS 3DEP, GEOID18 vertical `h = H + N`).

## Build (Cesium Terrain Builder / ctb-tile)

Prerequisites: GDAL, and [Cesium Terrain Builder](https://github.com/geo-data/cesium-terrain-builder)
(`ctb-tile`). All open source.

```bash
# 1. Assemble the 3DEP DEM for the tri-state extent (same source as the
#    Terrain-RGB pipeline — see build-terrain-rgb.sh for acquisition).
#    Output: merged GeoTIFF in EPSG:4326, elevations in NAVD88 feet or meters
#    (record which — do not mix).

# 2. Convert NAVD88 -> ellipsoidal heights BEFORE tiling, using the real
#    GEOID18 grid (never a constant offset):
python3 scripts/geospatial/apply-geoid18.py \
  --input merged-3dep-navd88.tif \
  --geoid data/geo/geoid18/g2018u0.bin \
  --output merged-3dep-ellipsoidal.tif
#    (h = H + N per scripts/geospatial/tsm_geodesy.py; fail-closed outside grid coverage)

# 3. Tile to quantized-mesh:
mkdir -p /tmp/qm-tiles
ctb-tile \
  --output-dir /tmp/qm-tiles \
  --start-zoom 0 --end-zoom 15 \
  merged-3dep-ellipsoidal.tif

# 4. Publish under the console's public dir (gitignored build output —
#    CI rebuilds it; see .github/workflows/deploy-pages.yml):
mkdir -p tsm-console/public/3d-tiles/terrain-quantized-mesh
cp -r /tmp/qm-tiles/* tsm-console/public/3d-tiles/terrain-quantized-mesh/
#    ctb-tile writes layer.json at the output root — that is what
#    CesiumTerrainProvider.fromUrl() consumes.
```

Verify: `curl -sI <base>/3d-tiles/terrain-quantized-mesh/layer.json` → 200,
and `0/0/0.terrain` exists.

## Imagery drape (self-hosted URL template)

`CesiumGlobeView` optionally drapes imagery from a self-hosted ZXY pyramid at:

```
tiles/imagery/{z}/{x}/{y}.png
```

Publish any self-hosted tile pyramid there (e.g. from the NAIP scene index in
the map pack, or Indiana orthoimagery). The layer is probed (`0/0/0.png`);
when absent it shows "unavailable" — nothing is fabricated and no remote
imagery service is ever contacted.

## PMTiles — single-file distribution for the offline bundle

For the air-gapped / USB-deployable offline bundle ("local first, air gapped,
usb deployable" — standing rule), [PMTiles](https://github.com/protomaps/PMTiles)
is the documented single-file distribution format:

- One `.pmtiles` file holds a full ZXY tile pyramid (terrain RGB, imagery,
  or vector tiles) — copyable to USB, servable over plain HTTPS with range
  requests, no tile server required.
- Build from an MBTiles with `pmtiles convert`, or from a tile directory with
  `pmtiles convert --tile-dir`.
- The console can read PMTiles client-side via the open-source `pmtiles`
  JS package; no server component, no keys.

```bash
# Example: Terrain-RGB MBTiles -> single-file PMTiles for the offline bundle
pmtiles convert terrain-3dep.mbtiles terrain-3dep.pmtiles
```

PMTiles is a distribution convenience only — it does not change provenance,
authority, or datum handling. Tiles inside carry the same labels as their
source pyramid.
