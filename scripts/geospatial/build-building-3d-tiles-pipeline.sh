#!/usr/bin/env bash
set -euo pipefail
ROOT=${1:?output root}; GEOJSON=${2:-tsm-console/public/data/posey-buildings-derived.geojson}
EXPECTED_BUILDINGS=${EXPECTED_BUILDINGS:-4121}; MAX_ITEMS=${HLOD_MAX_ITEMS:-50}; MAX_DEPTH=${HLOD_MAX_DEPTH:-6}; EXTRUSION=${BUILDING_EXTRUSION_FT:-10}
rm -rf "$ROOT"; mkdir -p "$ROOT"/{flat,hlod,stitched,compressed}
python3 scripts/geospatial/build-building-3d-tiles.py --geojson "$GEOJSON" --out-dir "$ROOT/flat" --extrusion-ft "$EXTRUSION"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/flat/tileset.json" --expected-buildings "$EXPECTED_BUILDINGS" --expected-glbs "$EXPECTED_BUILDINGS"
python3 scripts/geospatial/build-hlod-tileset.py --input "$ROOT/flat/tileset.json" --output "$ROOT/hlod/tileset.json" --max-items "$MAX_ITEMS" --max-depth "$MAX_DEPTH"
cp "$ROOT/flat/"*.glb "$ROOT/hlod/"
python3 - "$ROOT/hlod" <<'PY'
import hashlib,json,sys
from pathlib import Path
r=Path(sys.argv[1]); m=json.loads((r/"manifest.json").read_text()); m["content"]=sorted(p.name for p in r.glob("*.glb")); (r/"manifest.json").write_text(json.dumps(m,indent=2)+"\n")
paths=[r/"tileset.json",r/"manifest.json",*sorted(r.glob("*.glb"))]; (r/"SHA256SUMS").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in paths))
PY
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/hlod/tileset.json" --expected-buildings "$EXPECTED_BUILDINGS" --expected-glbs "$EXPECTED_BUILDINGS"
python3 scripts/geospatial/stitch-hlod-glbs.py --hlod "$ROOT/hlod/tileset.json" --source-dir "$ROOT/hlod" --out-dir "$ROOT/stitched"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/stitched/tileset.json" --expected-buildings "$EXPECTED_BUILDINGS" --strict-hlod
scripts/geospatial/compress-hlod-glbs.sh "$ROOT/stitched" "$ROOT/compressed"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/compressed/tileset.json" --expected-buildings "$EXPECTED_BUILDINGS" --require-draco --strict-hlod
