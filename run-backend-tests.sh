#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${REPO_ROOT}:${REPO_ROOT}/backend"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for the backend test gate." >&2
  exit 1
fi

echo "TSM backend pytest and unittest discovery"
echo "Repository: ${REPO_ROOT}"

# pytest collects both function-style tests and unittest.TestCase suites.
# unittest discovery silently omits the function-style engineering/API tests.
python3 -m pytest "${REPO_ROOT}/backend/tests" -v
