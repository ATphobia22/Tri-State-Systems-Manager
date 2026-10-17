#!/bin/bash
# Download large data files that exceed GitHub's 100MB limit
# Run this after cloning to fetch the large binaries

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Downloading USGS 3DEP 1m DEM (246 MB)..."
curl -o "$SCRIPT_DIR/usgs-3dep-1m/USGS_1M_16_x41y419_IN.tif" \
  "https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1m/Projects/IN_Indiana_Statewide_LiDAR_2017_B17/TIFF/USGS_1M_16_x41y419_IN_Indiana_Statewide_LiDAR_2017_B17.tif"

echo "Downloading Indiana 2020 DEM for Posey County (17 MB)..."
HREF=$(curl -s "https://di-ingov.img.arcgis.com/arcgis/rest/services/DynamicWebMercator/Indiana_2016_2020_DEM/ImageServer/exportImage?bbox=-9812098,4549048,-9767741,4593395&bboxSR=3857&imageSR=3857&size=2048,2048&format=tiff&pixelType=F32&f=json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('href',''))")
curl -o "$SCRIPT_DIR/indiana-dem-2020/posey-dem-2020-2k.tif" "$HREF"

echo "Done."
