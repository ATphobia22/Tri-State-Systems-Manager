#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed; container capability remains opt-in and no production stack is started." 
  exit 0
fi

while IFS= read -r -d '' file; do
  echo "Container definition discovered: ${file#$ROOT/}"
done < <(find "$ROOT" -maxdepth 4 \( -name 'Dockerfile*' -o -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' \) -print0)

echo "Container capability check passed."
