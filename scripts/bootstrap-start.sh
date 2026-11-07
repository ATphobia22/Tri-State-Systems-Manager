#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env ]]; then
  cp .env.bootstrap.example .env
  echo "Wrote .env from .env.bootstrap.example"
fi
docker compose -f docker-compose.bootstrap.yml up -d
sleep 5
export DATABASE_URL="${DATABASE_URL:-postgres://tsm:tsm@127.0.0.1:5433/tsm}"
npx --yes tsx services/migration-runner/src/index.ts
echo "Bootstrap up: PostGIS :5433  Redis :6379  Martin :3001"
