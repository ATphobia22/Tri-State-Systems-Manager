#!/usr/bin/env bash
# =============================================================================
# TSM Terrain-RGB builder — USGS 3DEP → Mapbox Terrain-RGB (256×256)
#
# Fail-closed contract:
#   - Does NOT invent elevation
#   - Does NOT commit bulk DEMs/tiles to git
#   - Does NOT set VITE_TSM_TERRAIN_RGB_URL_TEMPLATE (operator hosts tiles over HTTPS)
#   - Records SHA-256 provenance for every downloaded source product
#
# Preferred encoding path (recommended):
#   rio rgbify --base-val -10000 --interval 0.1 --min-z N --max-z M → .mbtiles
#   (avoids gdal2tiles bilinear resampling, which corrupts encoded elevation)
#
# Fallback path (if mbtiles tooling unavailable):
#   gdal2tiles.py -r near --tilesize=256 --xyz  (nearest-neighbor ONLY)
#
# Encoding (MapLibre raster-dem encoding: 'mapbox'):
#   height_m = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
#
# Dependencies (operator host):
#   curl, sha256sum, gdal (gdalinfo, gdalwarp, gdalbuildvrt, optional gdal2tiles.py)
#   python3 + pip packages: rasterio, rio-rgbify
#   optional: mb-util, pmtiles CLI, tippecanoe (not required for rgbify→mbtiles)
#
# Verified 3DEP access (2026-09-27):
#   S3 current: https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/{tile}/USGS_13_{tile}.tif
#   TNMAccess:  https://tnmaccess.nationalmap.gov/api/v1/products
#   Index:      https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK_DIR="${TSM_TERRAIN_WORK_DIR:-${ROOT}/data/3dep-processing}"
OUTPUT_DIR="${TSM_TERRAIN_OUTPUT_DIR:-${ROOT}/dist/terrain-tiles}"
MANIFEST="${WORK_DIR}/terrain-rgb-evidence-manifest.json"
MIN_ZOOM="${TSM_TERRAIN_MIN_ZOOM:-8}"
MAX_ZOOM="${TSM_TERRAIN_MAX_ZOOM:-14}"

# Posey / Ohio–Wabash confluence AOI — 1×1° 1/3-arc-second tiles (extend as needed)
TILES=(
  "n38w088"
  "n38w089"
  "n39w088"
  "n39w089"
)

S3_BASE="https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current"

log() { printf '[TSM terrain-rgb] %s\n' "$*"; }
die() { printf '[TSM terrain-rgb] ERROR: %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

need curl
need sha256sum
need gdalinfo
need gdalwarp
need gdalbuildvrt

mkdir -p "${WORK_DIR}/sources" "${OUTPUT_DIR}"
: > "${WORK_DIR}/source-hashes.txt"

log "Work dir: ${WORK_DIR}"
log "Output:   ${OUTPUT_DIR}"
log "Zoom:     ${MIN_ZOOM}-${MAX_ZOOM}"

# ---------------------------------------------------------------------------
# Step 1: Download authoritative 3DEP 1/3-arc-second GeoTIFF tiles (current)
# ---------------------------------------------------------------------------
log "Step 1 — fetch USGS 3DEP 1/3-arc-second (current) tiles"
SOURCE_LIST=()
for tile in "${TILES[@]}"; do
  url="${S3_BASE}/${tile}/USGS_13_${tile}.tif"
  dest="${WORK_DIR}/sources/USGS_13_${tile}.tif"
  if [[ -f "${dest}" ]]; then
    log "  skip existing ${tile}"
  else
    log "  GET ${url}"
    http=$(curl -sS -L --fail --retry 3 --retry-delay 2 -o "${dest}.partial" -w "%{http_code}" "${url}" || true)
    if [[ "${http}" != "200" ]]; then
      rm -f "${dest}.partial"
      die "download failed HTTP ${http} for ${url} (verify tile id; use TNMAccess if needed)"
    fi
    mv "${dest}.partial" "${dest}"
  fi
  hash=$(sha256sum "${dest}" | awk '{print $1}')
  echo "${hash}  USGS_13_${tile}.tif  ${url}" >> "${WORK_DIR}/source-hashes.txt"
  SOURCE_LIST+=("${dest}")
  log "  SHA-256 ${hash:0:16}…  ${tile}"
done

# ---------------------------------------------------------------------------
# Step 2: Mosaic + warp to Web Mercator (browser delivery CRS)
# Vertical values remain meters NAVD88 for CONUS 3DEP seamless products.
# gdalwarp does NOT convert vertical datum — only horizontal CRS.
# ---------------------------------------------------------------------------
log "Step 2 — mosaic + gdalwarp EPSG:3857 (horizontal only; NAVD88 preserved as values)"
VRT="${WORK_DIR}/dem_mosaic.vrt"
MERGED_3857="${WORK_DIR}/dem_3857.tif"

gdalbuildvrt -overwrite -srcnodata -999999 -vrtnodata -999999 "${VRT}" "${SOURCE_LIST[@]}"
gdalwarp -overwrite \
  -t_srs EPSG:3857 \
  -r bilinear \
  -dstnodata -999999 \
  -co COMPRESS=DEFLATE \
  -co TILED=YES \
  -co BIGTIFF=IF_SAFER \
  "${VRT}" \
  "${MERGED_3857}"

gdalinfo -stats "${MERGED_3857}" > "${WORK_DIR}/dem_3857.gdalinfo.txt" || true
MERGED_HASH=$(sha256sum "${MERGED_3857}" | awk '{print $1}')
log "  dem_3857.tif SHA-256 ${MERGED_HASH:0:16}…"

# ---------------------------------------------------------------------------
# Step 3: Terrain-RGB encoding
# Prefer rio-rgbify → MBTiles (correct elevation encoding end-to-end).
# ---------------------------------------------------------------------------
log "Step 3 — Mapbox Terrain-RGB encode"
MBTILES="${OUTPUT_DIR}/tsm-terrain-rgb.mbtiles"
RGB_TIF="${WORK_DIR}/terrain_rgb.tif"

if command -v rio >/dev/null 2>&1 && rio rgbify --help >/dev/null 2>&1; then
  log "  using rio rgbify → MBTiles (preferred)"
  rio rgbify \
    --base-val -10000 \
    --interval 0.1 \
    --min-z "${MIN_ZOOM}" \
    --max-z "${MAX_ZOOM}" \
    --format png \
    --workers "${TSM_TERRAIN_WORKERS:-4}" \
    "${MERGED_3857}" \
    "${MBTILES}"
  TILE_PRODUCT="${MBTILES}"
  TILE_METHOD="rio-rgbify-mbtiles"
elif command -v gdal2tiles.py >/dev/null 2>&1 || command -v gdal2tiles >/dev/null 2>&1; then
  log "  rio rgbify not found — fallback: encode + gdal2tiles -r near"
  if command -v rio >/dev/null 2>&1; then
    rio rgbify --base-val -10000 --interval 0.1 "${MERGED_3857}" "${RGB_TIF}"
  elif [[ -x "${ROOT}/scripts/geospatial/encode-terrain-rgb.py" ]]; then
    python3 "${ROOT}/scripts/geospatial/encode-terrain-rgb.py" \
      --input "${MERGED_3857}" \
      --output "${RGB_TIF}" \
      --vertical-datum NAVD88 \
      --units meters
  else
    die "install rio-rgbify (pip install rio-rgbify) or ensure encode-terrain-rgb.py + GDAL/numpy"
  fi
  G2T=$(command -v gdal2tiles.py || command -v gdal2tiles)
  # CRITICAL: -r near — bilinear/cubic corrupts Terrain-RGB encoded values
  "${G2T}" \
    --zoom="${MIN_ZOOM}-${MAX_ZOOM}" \
    --processes="${TSM_TERRAIN_WORKERS:-4}" \
    --tilesize=256 \
    --resampling=near \
    --xyz \
    "${RGB_TIF}" \
    "${OUTPUT_DIR}/xyz"
  TILE_PRODUCT="${OUTPUT_DIR}/xyz"
  TILE_METHOD="gdal2tiles-near-xyz"
else
  die "neither rio-rgbify nor gdal2tiles available — install: pip install rio-rgbify rasterio"
fi

# ---------------------------------------------------------------------------
# Step 4: Evidence manifest (operator publishes tiles; CI stays fail-closed)
# ---------------------------------------------------------------------------
log "Step 4 — write evidence manifest ${MANIFEST}"
RETRIEVED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
python3 - << PY
import json, pathlib
manifest = {
  "schema_version": "1.0.0",
  "status": "LOCAL_MATERIALIZED_PENDING_HTTPS_PUBLISH",
  "source_authority": "USGS 3DEP",
  "source_product": "1/3 arc-second seamless DEM (current)",
  "vertical_datum": "NAVD88",
  "source_horizontal_crs": "NAD83 geographic (EPSG:4269 / degrees)",
  "browser_crs": "EPSG:3857",
  "encoding": "mapbox",
  "tile_size": 256,
  "exaggeration_default": 1.0,
  "height_decode": "height_m = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1",
  "min_zoom": int("${MIN_ZOOM}"),
  "max_zoom": int("${MAX_ZOOM}"),
  "tile_method": "${TILE_METHOD}",
  "tile_product": "${TILE_PRODUCT}",
  "dem_3857_sha256": "${MERGED_HASH}",
  "retrieved_at": "${RETRIEVED_AT}",
  "sources": [],
  "runtime": {
    "environment_variable": "VITE_TSM_TERRAIN_RGB_URL_TEMPLATE",
    "fail_closed_until_https_template": True,
    "note": "Publish tiles under HTTPS XYZ or extract MBTiles to XYZ/CDN. Set VITE_TSM_TERRAIN_RGB_URL_TEMPLATE to https://YOUR-REAL-HOST/terrain/{z}/{x}/{y}.png — placeholders remain FAIL-CLOSED."
  },
  "documentation": "docs/TERRAIN-RGB-3DEP-PIPELINE.md",
}
hashes = pathlib.Path("${WORK_DIR}/source-hashes.txt").read_text().strip().splitlines()
for line in hashes:
  parts = line.split()
  if len(parts) >= 3:
    manifest["sources"].append({
      "content_hash_sha256": parts[0],
      "filename": parts[1],
      "source_uri": parts[2],
    })
pathlib.Path("${MANIFEST}").write_text(json.dumps(manifest, indent=2) + "\n")
print("wrote", "${MANIFEST}")
PY

log "Complete."
log "  Product: ${TILE_PRODUCT}"
log "  Manifest: ${MANIFEST}"
log "  Next: host tiles on HTTPS, then set:"
log "    VITE_TSM_TERRAIN_RGB_URL_TEMPLATE=https://YOUR-REAL-HOST/terrain/{z}/{x}/{y}.png"
log "  Do not commit ${WORK_DIR} or ${OUTPUT_DIR} bulk rasters to git."
log "  MapLibre remains FAIL-CLOSED until a non-placeholder HTTPS template is configured."
