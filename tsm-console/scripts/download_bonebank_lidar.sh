#!/usr/bin/env bash
set -euo pipefail

# Tri-State Systems Manager - Bonebank / Point Township LiDAR fetcher.
# Raw LAS files are intentionally not committed to Git; this utility materializes them locally.

S3_BASE="s3://giselevationingov/las/statewide/2020/SPW/ql2"
HTTPS_BASE="https://giselevationingov.s3.amazonaws.com/las/statewide/2020/SPW/ql2"
OUTPUT_DIR="${OUTPUT_DIR:-./data/lidar/raw}"

TILES=(
  "IN2020_26800940_12.las"
  "IN2020_26800970_12.las"
  "IN2020_26800975_12.las"
  "IN2020_26850940_12.las"
)

mkdir -p "${OUTPUT_DIR}"

fetch_with_curl() {
  local url="$1"
  local destination="$2"
  curl --fail --location --silent --show-error --retry 3 --retry-delay 2 \
    --output "${destination}.part" "${url}"
  mv "${destination}.part" "${destination}"
}

for tile in "${TILES[@]}"; do
  target="${OUTPUT_DIR}/${tile}"
  if [[ -s "${target}" ]]; then
    echo "[EXISTS] ${tile}"
    continue
  fi

  echo "[FETCHING] ${tile}"
  if command -v aws >/dev/null 2>&1 && aws s3 cp --no-sign-request \
      "${S3_BASE}/${tile}" "${target}.part"; then
    mv "${target}.part" "${target}"
  else
    rm -f "${target}.part"
    fetch_with_curl "${HTTPS_BASE}/${tile}" "${target}"
  fi

  [[ -s "${target}" ]] || { echo "[ERROR] Empty download: ${target}" >&2; exit 1; }
  echo "[COMPLETE] ${tile} ($(du -h "${target}" | cut -f1))"
done

echo "LiDAR materialization complete: ${OUTPUT_DIR}"
