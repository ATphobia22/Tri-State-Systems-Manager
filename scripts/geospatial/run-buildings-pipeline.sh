#!/usr/bin/env bash
set -euo pipefail

# Canonical Posey building pipeline.
# The former parcel/Microsoft fallback path is intentionally retired: production
# building geometry must originate from the authoritative Indiana GIO
# Building_Footprints 2016-2020 layer and contain exactly 23,082 footprints.

ROOT=${1:-/tmp/tsm-buildings}
GEOJSON=${2:-/tmp/tsm-igio/posey-buildings-igio-enriched.geojson}
EXPECTED_BUILDINGS=${EXPECTED_BUILDINGS:-23082}

mkdir -p "$(dirname "$GEOJSON")"
if [[ ! -s "$GEOJSON" ]]; then
  python3 scripts/geospatial/acquire-and-enrich-igio-posey-buildings.py \
    --output "$GEOJSON" \
    --expected-count "$EXPECTED_BUILDINGS"
fi

test "$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))["features"]))' "$GEOJSON")" = "$EXPECTED_BUILDINGS"

EXPECTED_BUILDINGS="$EXPECTED_BUILDINGS" \
  bash scripts/geospatial/build-building-3d-tiles-pipeline.sh "$ROOT" "$GEOJSON"
