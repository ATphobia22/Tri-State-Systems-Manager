#!/usr/bin/env bash
# build-terrain-rgb.sh — build the TSM Terrain-RGB tile pyramid.
#
# Reads the bundled screening DEM
# (tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json,
# produced by tools/terrain/fetch-terrarium-dem.py) and renders Web-Mercator
# XYZ PNG tiles in the Mapbox Terrain-RGB encoding, plus a TileJSON manifest.
#
# The tiles are screening-level elevation, not survey-grade; the encoding
# carries no datum transform. Serve the output dir over HTTPS and point
# VITE_TSM_TERRAIN_TILE_URL at it (see ops/terrain-tiles/).
#
# Usage:
#   ./scripts/geospatial/build-terrain-rgb.sh [--out-dir DIR]
#       [--minzoom Z] [--maxzoom Z] [--tiles-url TEMPLATE]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEM_JSON="$REPO_ROOT/tsm-console/src/lib/flood-sim/world/data/source-derived-dem-posey.json"
OUT_DIR="$REPO_ROOT/ops/terrain-tiles/data/terrain-rgb"
MINZOOM=11
MAXZOOM=15
TILES_URL="https://tiles.example.com/terrain-rgb/{z}/{x}/{y}.png"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --minzoom) MINZOOM="$2"; shift 2 ;;
    --maxzoom) MAXZOOM="$2"; shift 2 ;;
    --tiles-url) TILES_URL="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$DEM_JSON" ]]; then
  echo "DEM not found: $DEM_JSON" >&2
  echo "Run tools/terrain/fetch-terrarium-dem.py first." >&2
  exit 1
fi

for mod in numpy PIL; do
  if ! python3 -c "import $mod" 2>/dev/null; then
    echo "python3 module '$mod' is required (pip install $mod)" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"
python3 "$REPO_ROOT/scripts/geospatial/build-terrain-rgb-tiles.py" \
  --dem-json "$DEM_JSON" \
  --out-dir "$OUT_DIR" \
  --minzoom "$MINZOOM" \
  --maxzoom "$MAXZOOM" \
  --tiles-url "$TILES_URL"

echo "tile pyramid ready: $OUT_DIR"
