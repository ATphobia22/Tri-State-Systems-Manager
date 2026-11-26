#!/usr/bin/env bash
set -euo pipefail
DATA_DIR="${1:-./data}"
GML_FILE="${2:-city.gml}"
HOST="${CITYDB_HOST:-localhost}"
PORT="${CITYDB_PORT:-5432}"
DB="${CITYDB_NAME:-postgres}"
USER="${CITYDB_USERNAME:-postgres}"
PASS="${CITYDB_PASSWORD:-changeMe}"
docker run -i -t --rm --network host -u "$(id -u):$(id -g)" -v "${DATA_DIR}:/data" \
  -e CITYDB_HOST="$HOST" -e CITYDB_PORT="$PORT" -e CITYDB_NAME="$DB" \
  -e CITYDB_USERNAME="$USER" -e CITYDB_PASSWORD="$PASS" \
  3dcitydb/citydb-tool import citygml "/data/${GML_FILE}"
echo "Import complete: ${GML_FILE}"
