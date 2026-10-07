#!/usr/bin/env bash
set -euo pipefail

ROOT=${1:?output root}
GEOJSON=${2:-/tmp/tsm-igio/posey-buildings-igio-enriched.geojson}
EXPECTED=${EXPECTED_BUILDINGS:-23082}
MAX_ITEMS=${HLOD_MAX_ITEMS:-50}
MAX_DEPTH=${HLOD_MAX_DEPTH:-6}
LIDAR_DIR=${LIDAR_DIR:-/tmp/tsm-lidar}

rm -rf "$ROOT"
mkdir -p "$ROOT"/{flat,hlod,stitched,compressed}

if [[ "${TSM_SKIP_LIDAR_ACQUISITION:-false}" != "true" ]]; then
  bash tsm-console/scripts/download-posey-lidar-tiles.sh "$LIDAR_DIR"
fi

mapfile -t LAS_FILES < <(find "$LIDAR_DIR" -maxdepth 1 -type f -name '*.las' -print | sort)
if (( ${#LAS_FILES[@]} == 0 )); then
  echo "FAIL: no Indiana 3DEP LAS tiles available for height derivation" >&2
  exit 1
fi

HEIGHTS="$ROOT/posey-buildings-with-lidar-heights.geojson"
LAS_ARGS=()
for f in "${LAS_FILES[@]}"; do LAS_ARGS+=(--las "$f"); done
python3 scripts/geospatial/derive-building-heights-from-lidar.py   --geojson "$GEOJSON"   --output "$HEIGHTS"   --expected-buildings "$EXPECTED"   "${LAS_ARGS[@]}"

python3 scripts/geospatial/build-building-3d-tiles.py   --geojson "$HEIGHTS"   --out-dir "$ROOT/flat"   --height-field buildingHeightFt   --expected-buildings "$EXPECTED"

python3 scripts/geospatial/validate-building-3d-tiles.py   --tileset "$ROOT/flat/tileset.json"   --tiles-dir "$ROOT/flat"   --expected-buildings "$EXPECTED"   --expected-glbs "$EXPECTED"

python3 scripts/geospatial/build-hlod-tileset.py   --input "$ROOT/flat/tileset.json"   --output "$ROOT/hlod/tileset.json"   --max-items "$MAX_ITEMS"   --max-depth "$MAX_DEPTH"

cp "$ROOT/flat/"*.glb "$ROOT/hlod/"
cp "$ROOT/flat/manifest.json" "$ROOT/hlod/manifest.json"
cp "$ROOT/flat/SHA256SUMS" "$ROOT/hlod/SHA256SUMS"

python3 - "$ROOT/hlod" <<'PY'
import hashlib, json, sys
from pathlib import Path
r = Path(sys.argv[1])
m = json.loads((r / "manifest.json").read_text())
m["stage"] = "hlod"
m["content"] = sorted(p.name for p in r.glob("*.glb"))
(r / "manifest.json").write_text(json.dumps(m, indent=2) + "\n")
paths = [r / "tileset.json", r / "manifest.json", *sorted(r.glob("*.glb"))]
(r / "SHA256SUMS").write_text(
    "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths)
)
PY

python3 scripts/geospatial/validate-building-3d-tiles.py   --tileset "$ROOT/hlod/tileset.json"   --tiles-dir "$ROOT/hlod"   --expected-buildings "$EXPECTED"   --expected-glbs "$EXPECTED"

python3 scripts/geospatial/stitch-building-glbs.py   --tileset "$ROOT/hlod/tileset.json"   --tiles-dir "$ROOT/hlod"   --output "$ROOT/stitched/tileset.json"   --stitched-dir "$ROOT/stitched/stitched"

cp "$ROOT/hlod/manifest.json" "$ROOT/stitched/manifest.json"

python3 scripts/geospatial/validate-building-3d-tiles.py   --tileset "$ROOT/stitched/tileset.json"   --tiles-dir "$ROOT/stitched"   --expected-buildings "$EXPECTED"   --strict-hlod

bash scripts/geospatial/compress-hlod-glbs.sh "$ROOT/stitched" "$ROOT/compressed"

python3 scripts/geospatial/validate-building-3d-tiles.py   --tileset "$ROOT/compressed/tileset.json"   --tiles-dir "$ROOT/compressed"   --expected-buildings "$EXPECTED"   --require-draco   --strict-hlod

echo "Building 3D Tiles pipeline complete: $ROOT/compressed"
