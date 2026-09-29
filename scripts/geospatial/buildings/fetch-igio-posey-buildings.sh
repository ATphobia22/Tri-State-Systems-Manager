#!/usr/bin/env bash
# Fetch Posey County building footprints from the Indiana GIO FeatureServer
# and normalize to EPSG:2966 GeoJSON for offline use.
#
# Source (verified 2026-09-29): "Indiana Building Footprints 2016-2020"
#   https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0
#   Fields: objectid, lidaryear, county, SHAPE__Length, SHAPE__Area
#   County query returned 23,082 Posey County footprints on 2026-09-29.
#
# Output: data/posey-county/buildings/posey_buildings_igio_{4326,2966}.geojson
# plus a SHA-256 sidecar. Reference data only — not survey evidence.
#
# Adapted from an external pipeline; endpoint and feature count verified
# against the live Indiana GIO service before vendoring this script.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="${ROOT}/data/posey-county/buildings"
WORKDIR="${TMPDIR:-/tmp}/tsm_igio_bldg_$$"
BASE="https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0/query"
OUT_4326="${OUT_DIR}/posey_buildings_igio_4326.geojson"
OUT_2966="${OUT_DIR}/posey_buildings_igio_2966.geojson"
PAGE=2000
OFFSET=0

mkdir -p "${OUT_DIR}" "${WORKDIR}"
cd "${WORKDIR}"

echo "=== Paginated IGIO query (county='Posey') ==="
PARTS=()
i=0
while true; do
  PART="page_${i}.geojson"
  URL="${BASE}?where=county%3D%27Posey%27&outFields=objectid,lidaryear,county&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=${PAGE}&resultOffset=${OFFSET}"
  curl -fsSL --retry 3 -o "${PART}" "${URL}" || {
    echo "SOFT_FAIL: IGIO query failed at offset ${OFFSET}; no partial output promoted."
    exit 0
  }
  N=$(grep -o '"type"[[:space:]]*:[[:space:]]*"Feature"' "${PART}" | wc -l | tr -d ' ')
  echo "offset=${OFFSET} features~${N}"
  PARTS+=("${PART}")
  if [[ "${N}" -lt "${PAGE}" ]]; then
    break
  fi
  OFFSET=$((OFFSET + PAGE))
  i=$((i + 1))
  if [[ "${i}" -gt 500 ]]; then
    echo "ERROR: pagination safety stop"
    exit 1
  fi
done

if command -v ogrmerge.py >/dev/null 2>&1; then
  ogrmerge.py -q -o merged.geojson -f GeoJSON "${PARTS[@]}" -single -nln buildings
else
  ogr2ogr -f GeoJSON merged.geojson "${PARTS[0]}"
  for ((j = 1; j < ${#PARTS[@]}; j++)); do
    ogr2ogr -f GeoJSON -append merged.geojson "${PARTS[$j]}" || true
  done
fi

cp -f merged.geojson "${OUT_4326}"
ogr2ogr -f GeoJSON -t_srs EPSG:2966 -s_srs EPSG:4326 "${OUT_2966}" "${OUT_4326}"

sha256sum "${OUT_2966}" | tee "${OUT_DIR}/posey_buildings_igio_2966.sha256"

echo "Wrote ${OUT_2966}"
echo "Anchor-area clip example (public anchor 37.845887, -88.005075):"
echo "  ogr2ogr -f GeoJSON -clipsrc -88.03 37.83 -87.98 37.86 \\"
echo "    ${OUT_DIR}/bonebank_anchor_buildings.geojson ${OUT_2966}"

rm -rf "${WORKDIR}"
