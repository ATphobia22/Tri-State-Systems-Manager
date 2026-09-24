#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
node "$ROOT/scripts/ci/validate-capability-registry.mjs"
node "$ROOT/scripts/ci/validate-artifact-manifests.mjs"

[[ -f "$ROOT/integrations/geospatial/3d-asset-contract.schema.json" ]] || {
  echo 'Missing 3D geospatial asset contract.' >&2
  exit 1
}
[[ -f "$ROOT/integrations/cityengine/asset-manifest.schema.json" ]] || {
  echo 'Missing CityEngine asset manifest contract.' >&2
  exit 1
}

echo "Geospatial capability contracts passed."
