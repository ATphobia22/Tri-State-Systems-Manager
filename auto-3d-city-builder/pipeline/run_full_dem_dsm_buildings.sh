#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p data/dem data/lidar data/citygml logs
need() { command -v "$1" >/dev/null 2>&1 || { echo "MISSING: $1 — conda install -c conda-forge pdal gdal"; exit 1; }; }
need pdal
echo "[1/5] Preview 5m DEM"
pdal pipeline scripts/geospatial/pdal_3dep_preview.json 2>&1 | tee logs/pdal_preview.log || true
echo "[2/5] Ground DEM 1m"
pdal pipeline scripts/geospatial/pdal_3dep_clip.json 2>&1 | tee logs/pdal_clip.log
echo "[3/5] DSM 1m"
pdal pipeline scripts/geospatial/pdal_3dep_dsm.json 2>&1 | tee logs/pdal_dsm.log
echo "[4/5] Buildings LAZ"
pdal pipeline scripts/geospatial/pdal_3dep_buildings.json 2>&1 | tee logs/pdal_buildings.log
echo "[5/5] LoD1/2 + CityGML import"
bash auto-3d-city-builder/pipeline/lod12_from_dem.sh 2>&1 | tee logs/lod12.log || true
bash auto-3d-city-builder/pipeline/run_pdal_then_citygml.sh 2>&1 | tee logs/citygml_import.log || true
ls -lh data/dem/*.tif data/lidar/*.laz data/citygml/*.gml 2>/dev/null || true
echo "FULL DEM/DSM/BUILDINGS pipeline finished"
