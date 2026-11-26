#!/usr/bin/env bash
# Delegate once to the evidence-bound engine; do not rerun unpinned PDAL stages.
set -euo pipefail
PIPELINE="$(cd "$(dirname "$0")" && pwd)"
exec bash "$PIPELINE/run_pdal_then_citygml.sh" "$@"
