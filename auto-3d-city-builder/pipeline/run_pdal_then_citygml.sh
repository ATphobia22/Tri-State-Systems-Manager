#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p data/dem data/lidar data/citygml
run_pdal() {
  echo "=== PDAL: $1 ==="
  if command -v pdal >/dev/null 2>&1; then pdal pipeline "scripts/geospatial/$1"; else echo "SKIP: install pdal (conda-forge)"; return 1; fi
}
ok=0
run_pdal pdal_3dep_clip.json && ok=$((ok+1)) || true
run_pdal pdal_3dep_dsm.json && ok=$((ok+1)) || true
run_pdal pdal_3dep_buildings.json && ok=$((ok+1)) || true
echo "PDAL stages: $ok / 3"
GML="data/citygml/posey_lod1.gml"
[[ -f "$GML" ]] || GML="data/citygml/mount_vernon_lod1_sample.gml"
if command -v docker >/dev/null 2>&1; then
  (cd auto-3d-city-builder/docker && CITYDB_SRID=26916 docker compose up -d citydb) || true
  bash auto-3d-city-builder/pipeline/import_citygml.sh "$(pwd)/data/citygml" "$(basename "$GML")"
else
  echo "SKIP docker — import later: bash auto-3d-city-builder/pipeline/import_citygml.sh data/citygml $(basename "$GML")"
fi
