#!/usr/bin/env bash
set -euo pipefail
IN_DIR="${1:-./opendrive}"
OUT_DIR="${2:-./citygml_roads}"
RTRON_JAR="${RTRON_JAR:-./tools/rtron.jar}"
mkdir -p "$OUT_DIR" ./reports
java -jar "$RTRON_JAR" validate-opendrive "$IN_DIR" ./reports
java -jar "$RTRON_JAR" opendrive-to-citygml "$IN_DIR" "$OUT_DIR"
echo "CityGML written to ${OUT_DIR}"
