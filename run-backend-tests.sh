#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${REPO_ROOT}:${REPO_ROOT}/backend"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for the backend test gate." >&2
  exit 1
fi

echo "TSM backend unittest discovery"
echo "Repository: ${REPO_ROOT}"

python3 -m unittest discover \
  -s "${REPO_ROOT}/backend/tests" \
  -p 'test_*.py' \
  -v
