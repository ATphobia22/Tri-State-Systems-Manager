#!/usr/bin/env bash
set -euo pipefail
ROOT=${1:?output root}; GEOJSON=${2:-tsm-console/public/data/posey-buildings-derived.geojson}
EXPECTED=${EXPECTED_BUILDINGS:-4121}; MAX_ITEMS=${HLOD_MAX_ITEMS:-50}; MAX_DEPTH=${HLOD_MAX_DEPTH:-6}; EXTRUSION=${BUILDING_EXTRUSION_FT:-10}
rm -rf "$ROOT"; mkdir -p "$ROOT"/{flat,hlod,stitched,compressed}
python3 scripts/geospatial/build-building-3d-tiles.py --geojson "$GEOJSON" --out-dir "$ROOT/flat" --extrusion-ft "$EXTRUSION"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/flat/tileset.json" --tiles-dir "$ROOT/flat" --expected-buildings "$EXPECTED" --expected-glbs "$EXPECTED"
python3 scripts/geospatial/build-hlod-tileset.py --input "$ROOT/flat/tileset.json" --output "$ROOT/hlod/tileset.json" --max-items "$MAX_ITEMS" --max-depth "$MAX_DEPTH"
cp "$ROOT/flat/"*.glb "$ROOT/hlod/"
cp "$ROOT/flat/manifest.json" "$ROOT/hlod/manifest.json"
cp "$ROOT/flat/SHA256SUMS" "$ROOT/hlod/SHA256SUMS"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/hlod/tileset.json" --tiles-dir "$ROOT/hlod" --expected-buildings "$EXPECTED" --expected-glbs "$EXPECTED"
python3 scripts/geospatial/stitch-building-glbs.py --tileset "$ROOT/hlod/tileset.json" --tiles-dir "$ROOT/hlod" --output "$ROOT/stitched/tileset.json" --stitched-dir "$ROOT/stitched/stitched"
cp "$ROOT/hlod/manifest.json" "$ROOT/stitched/manifest.json"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/stitched/tileset.json" --tiles-dir "$ROOT/stitched" --expected-buildings "$EXPECTED" --strict-hlod
scripts/geospatial/compress-hlod-glbs.sh "$ROOT/stitched" "$ROOT/compressed"
python3 scripts/geospatial/validate-building-3d-tiles.py --tileset "$ROOT/compressed/tileset.json" --tiles-dir "$ROOT/compressed" --expected-buildings "$EXPECTED" --require-draco --strict-hlod
echo "Building 3D Tiles pipeline complete: $ROOT/compressed"
