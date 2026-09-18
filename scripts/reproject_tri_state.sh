#!/usr/bin/env bash
set -euo pipefail

# TSM evidence-first elevation reprojection boundary.
# The input raster's embedded horizontal CRS and vertical metadata are validated
# before GDAL is allowed to transform it. Vertical datum conversion is NOT
# performed by this script; it remains an explicit upstream/downstream operation.

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/reproject_tri_state.sh --input INPUT.tif --output OUTPUT.tif \
    --source-crs EPSG:3089|EPSG:26916|EPSG:2966 \
    --vertical-datum NAVD88

The source CRS is an assertion that must match the raster metadata. It is not
used to relabel an incorrectly tagged raster. Output is always EPSG:2966.
EOF
  exit 2
}

INPUT=""
OUTPUT=""
SOURCE_CRS=""
VERTICAL_DATUM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="${2:-}"; shift 2 ;;
    --output) OUTPUT="${2:-}"; shift 2 ;;
    --source-crs) SOURCE_CRS="${2:-}"; shift 2 ;;
    --vertical-datum) VERTICAL_DATUM="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -n "$INPUT" && -n "$OUTPUT" && -n "$SOURCE_CRS" && -n "$VERTICAL_DATUM" ]] || usage
[[ -f "$INPUT" ]] || { echo "Input raster does not exist: $INPUT" >&2; exit 1; }
[[ "$INPUT" != "$OUTPUT" ]] || { echo "Input and output must differ." >&2; exit 1; }

case "$SOURCE_CRS" in
  EPSG:3089|EPSG:26916|EPSG:2966) ;;
  *) echo "Unsupported source CRS: $SOURCE_CRS" >&2; exit 1 ;;
esac

case "$VERTICAL_DATUM" in
  NAVD88) ;;
  *) echo "Unsupported/unverified vertical datum: $VERTICAL_DATUM" >&2; exit 1 ;;
esac

command -v gdalinfo >/dev/null || { echo "gdalinfo is required." >&2; exit 1; }
command -v gdalsrsinfo >/dev/null || { echo "gdalsrsinfo is required." >&2; exit 1; }
command -v gdalwarp >/dev/null || { echo "gdalwarp is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 1; }

# Validate the embedded horizontal CRS; never use --source-crs to relabel input.
ACTUAL_EPSG="$(gdalsrsinfo -o epsg "$INPUT" 2>/dev/null | grep -Eo 'EPSG:[0-9]+' | head -n1 || true)"
[[ "$ACTUAL_EPSG" == "$SOURCE_CRS" ]] || {
  echo "FAIL-CLOSED: embedded CRS $ACTUAL_EPSG does not match declared $SOURCE_CRS." >&2
  exit 1
}

# NAVD88 must be explicitly present in raster metadata. EPSG 5703/6360 are
# accepted NAVD88 height CRS identifiers used by the repository's raster gate.
RASTER_INFO="$(gdalinfo "$INPUT" 2>/dev/null)"
grep -Eq 'NAVD88|5703|6360' <<<"$RASTER_INFO" || {
  echo "FAIL-CLOSED: raster metadata does not explicitly identify NAVD88 (EPSG:5703/6360)." >&2
  exit 1
}

# Reject malformed rasters before transformation.
grep -Eq 'Size is [1-9][0-9]*, [1-9][0-9]*' <<<"$RASTER_INFO" || {
  echo "FAIL-CLOSED: raster dimensions are unavailable or invalid." >&2
  exit 1
}
grep -Eq 'NoData Value|NoData' <<<"$RASTER_INFO" || {
  echo "FAIL-CLOSED: raster nodata metadata is unavailable." >&2
  exit 1
}

mkdir -p "$(dirname "$OUTPUT")"
TMP_OUTPUT="${OUTPUT}.part.$$"
trap 'rm -f "$TMP_OUTPUT"' EXIT

gdalwarp \
  -t_srs EPSG:2966 \
  -r near \
  -dstnodata none \
  -multi \
  -overwrite \
  "$INPUT" "$TMP_OUTPUT"

OUTPUT_EPSG="$(gdalsrsinfo -o epsg "$TMP_OUTPUT" 2>/dev/null | grep -Eo 'EPSG:[0-9]+' | head -n1 || true)"
[[ "$OUTPUT_EPSG" == "EPSG:2966" ]] || {
  echo "FAIL-CLOSED: output CRS is $OUTPUT_EPSG, expected EPSG:2966." >&2
  exit 1
}

gdalinfo "$TMP_OUTPUT" >/dev/null
mv "$TMP_OUTPUT" "$OUTPUT"

INPUT_SHA256="$(sha256sum "$INPUT" | awk '{print $1}')"
OUTPUT_SHA256="$(sha256sum "$OUTPUT" | awk '{print $1}')"
cat > "${OUTPUT}.evidence.json" <<EOF
{
  "schema": "tsm.geospatial-reprojection-evidence.v1",
  "operation": "horizontal_reprojection_only",
  "input": "$INPUT",
  "input_sha256": "$INPUT_SHA256",
  "declared_source_crs": "$SOURCE_CRS",
  "verified_source_crs": "$ACTUAL_EPSG",
  "vertical_datum": "$VERTICAL_DATUM",
  "vertical_transformation_applied": false,
  "target_horizontal_crs": "EPSG:2966",
  "resampling": "near",
  "output": "$OUTPUT",
  "output_sha256": "$OUTPUT_SHA256"
}
EOF

echo "PASS: $INPUT -> $OUTPUT"
echo "Evidence: ${OUTPUT}.evidence.json"
