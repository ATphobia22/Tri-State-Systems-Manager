#!/usr/bin/env bash
# PTDT v35 — One-click deploy (backend + PostGIS)
set -euo pipefail

echo "======================================================================"
echo " PTDT v35 SOVEREIGN STACK — DEPLOY"
echo "======================================================================"

command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }

echo "[1/3] Launching compose stack..."
docker compose up -d --build

echo "[2/3] Waiting for API health..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:8000/api/v1/health | grep -q ONLINE_ACTIVE; then
    echo "  API healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 20 ]; then
    echo "API health timeout"
    docker compose logs backend_api
    exit 1
  fi
done

echo "[3/3] Done"
echo "  API:  http://localhost:8000/docs"
echo "  WS:   ws://localhost:8000/ws/telemetry"
echo "  DB:   localhost:5432 (ptdt_v35)"
echo "  Lock: BFE 375.0 | LAG 377.2 | FFE 382.5 | EPSG:2966 | CID 180209"
