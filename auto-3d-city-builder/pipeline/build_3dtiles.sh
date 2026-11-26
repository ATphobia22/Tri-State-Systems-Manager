#!/usr/bin/env bash
set -euo pipefail
OUT_DIR="${1:-./tiles}"
HOST="${CITYDB_HOST:-localhost}"
PORT="${CITYDB_PORT:-5432}"
DB="${CITYDB_NAME:-postgres}"
USER="${CITYDB_USERNAME:-postgres}"
PASS="${CITYDB_PASSWORD:-changeMe}"
SRID="${CITYDB_SRID:-26916}"
mkdir -p "$OUT_DIR"
if docker image inspect tumgis/citydb-3dtiler:latest >/dev/null 2>&1; then
  docker run --rm --network host -v "$(pwd)/${OUT_DIR}:/out" \
    -e CITYDB_HOST="$HOST" -e CITYDB_PORT="$PORT" -e CITYDB_NAME="$DB" \
    -e CITYDB_USERNAME="$USER" -e CITYDB_PASSWORD="$PASS" \
    tumgis/citydb-3dtiler:latest --output /out --srid "$SRID"
  echo "citydb-3dtiler → ${OUT_DIR}"
  exit 0
fi
if command -v pg2b3dm >/dev/null 2>&1; then
  pg2b3dm -U "$USER" -h "$HOST" -p "$PORT" -d "$DB" -t citydb.geometry_data -c geometry -o "$OUT_DIR"
  echo "pg2b3dm → ${OUT_DIR}"
  exit 0
fi
echo "Neither citydb-3dtiler nor pg2b3dm found" >&2
exit 1
