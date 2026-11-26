#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEM="${DEM:-$ROOT/data/dem/posey_ground_1m.tif}"
DSM="${DSM:-$ROOT/data/dem/posey_dsm_1m.tif}"
mkdir -p "$(dirname "$DEM")"
[[ -f "$DEM" ]] || pdal pipeline "$ROOT/scripts/geospatial/pdal_3dep_clip.json"
[[ -f "$DSM" ]] || pdal pipeline "$ROOT/scripts/geospatial/pdal_3dep_dsm.json" || true
echo "DEM=$DEM DSM=$DSM — join footprints for LoD1 measuredHeight; citydb-tool import; CEII/PE out of scope"
