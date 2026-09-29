#!/usr/bin/env bash
# TSM workspace bootstrap — TRULY IDEMPOTENT.
# Safe to run any number of times; re-runs change nothing when the workspace
# is already in the desired state. Never overwrites existing files.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

mkdir_once() {
    # mkdir -p is idempotent by definition; the wrapper documents intent.
    mkdir -p "$1"
}

file_once() {
    # Create only when absent — never touch or truncate an existing file.
    local file="$1"
    if [ ! -f "$file" ]; then
        touch "$file"
        echo "[TSM] created $file"
    fi
}

compose_up_once() {
    # `docker compose up -d` is itself idempotent (reconciles to desired
    # state), but we still guard on docker availability and compose file
    # presence so the script succeeds on machines without Docker.
    local compose_file="$1"
    if ! command -v docker >/dev/null 2>&1; then
        echo "[TSM] docker not found; skipping container startup"
        return 0
    fi
    if [ ! -f "$compose_file" ]; then
        echo "[TSM] compose file not found: $compose_file; skipping"
        return 0
    fi
    if ! docker compose -f "$compose_file" up -d; then
        echo "[TSM] WARNING: docker compose up failed; continuing" >&2
    fi
}

echo "[TSM] Ensuring directories"
for dir in \
    database \
    database/migrations \
    evidence \
    evidence/hashes \
    evidence/frames \
    evidence/snapshots \
    runtime \
    tsm-native/Plugins \
    offline_packages \
    offline_packages/lidar \
    offline_packages/imagery \
    offline_packages/fema \
    offline_packages/usgs \
    offline_packages/noaa \
    offline_packages/simulations \
    offline_packages/evidence \
    artifacts \
    docs \
    tests
do
    mkdir_once "$dir"
done

echo "[TSM] Ensuring environment file"
file_once ".env"

echo "[TSM] Ensuring offline package registry skeleton"
file_once "offline_packages/README.md"

echo "[TSM] Starting containers (if configured)"
# Prefer the repo's real compose file; fall back to a conventional path.
if [ -f "deploy/oracle/docker-compose.yml" ]; then
    compose_up_once "deploy/oracle/docker-compose.yml"
elif [ -f "docker/docker-compose.yml" ]; then
    compose_up_once "docker/docker-compose.yml"
else
    echo "[TSM] no compose file found; skipping container startup"
fi

echo "[TSM] Bootstrap complete (idempotent — safe to re-run)"
