#!/usr/bin/env bash
# Compatibility entrypoint for the source-bound Mount Vernon review pilot.
# The pilot explicitly marks every model as publication/engineering ineligible.
set -euo pipefail
if [[ "${1:-}" != --review || "$#" -lt 3 ]]; then
  echo 'BLOCKED: production import is not authorized by the Roofer review receipts.' >&2
  echo 'Usage: run_pdal_then_citygml.sh --review REVIEW_DIR NEW_OUTPUT_DIR --pdal PATH --ogr2ogr PATH --roofer PATH' >&2
  exit 2
fi
shift
# Preserve caller-relative paths. The installed engine verifies pinned source
# hashes and compound CRS, checks subprocess exits, and rejects empty candidates.
# Do not start Docker, convert to CityGML, or import review-only CityJSONSeq.
export PROJ_NETWORK=OFF
exec python3 -m citybuilder.pdal_roofer "$@"
