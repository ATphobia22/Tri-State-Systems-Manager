#!/usr/bin/env bash
# Download Bonebank-adjacent Indiana 3DEP QL2 LAS tiles (CC0 open data)
# Bucket: s3://giselevationingov (us-east-2), no AWS account required
set -euo pipefail
OUT="${1:-data/lidar/posey/las}"
mkdir -p "$OUT"
BASE="https://giselevationingov.s3.us-east-2.amazonaws.com/las/statewide/2020/SPW/ql2"
TILES=(
  IN2020_26800940_12  # primary low-ground (existing analysis)
  IN2020_26800945_12  # adjacent
  IN2020_26800935_12  # adjacent
  IN2020_26800970_12  # higher northing candidate
  IN2020_26800975_12  # higher northing candidate
  IN2020_26850940_12  # easting 2685 candidate
)
for t in "${TILES[@]}"; do
  dest="$OUT/${t}.las"
  if [[ -f "$dest" ]]; then
    echo "[skip] $dest exists"
    continue
  fi
  echo "[fetch] $t.las (~300-430 MB)"
  curl -fL --retry 3 -o "$dest" "$BASE/${t}.las"
done
echo "[hash] writing SHA256SUMS-las.txt"
(cd "$OUT" && sha256sum *.las > SHA256SUMS-las.txt)
echo "[done] Run PDAL Class 2 buffer LAG next — human LOMA package only"
