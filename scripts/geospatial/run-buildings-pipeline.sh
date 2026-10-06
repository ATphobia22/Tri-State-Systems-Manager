#!/usr/bin/env bash
# End-to-end Posey buildings pipeline (steps 1–7).
# Requires: python3, optional MS Indiana.geojson.zip, terrain_3dep tiles.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MS_ZIP="${MS_ZIP:-}"
WSE_FT="${WSE_FT:-375.0}"
LIMIT="${LIMIT:-0}"  # 0 = all; set e.g. 50 for smoke

echo "=== 1. Acquire footprints ==="
if [ -n "$MS_ZIP" ] && [ -f "$MS_ZIP" ]; then
  python3 scripts/geospatial/acquire-posey-building-footprints.py --ms-zip "$MS_ZIP"
else
  python3 scripts/geospatial/acquire-posey-building-footprints.py
fi

FOOT="data/buildings/posey-ms-buildings-aoi.geojson"
JOINED="data/buildings/posey-buildings-elev-joined.geojson"

echo "=== 2. Elevation join ==="
if [ -d tsm-console/public/terrain_3dep ]; then
  JOIN_ARGS=(--input "$FOOT" --output "$JOINED" --wse-ft "$WSE_FT"
             --wse-source "BFE 375.0 ft NAVD88 screening")
  if [ "$LIMIT" -gt 0 ]; then JOIN_ARGS+=(--limit "$LIMIT"); fi
  python3 scripts/geospatial/join-footprints-elevation.py "${JOIN_ARGS[@]}"
else
  echo "[WARN] terrain_3dep missing; using input without new elev samples"
  cp "$FOOT" "$JOINED"
fi

echo "=== 3. Mesh (LOD1) ==="
MESH_DIR="tsm-console/public/data/buildings-3d-tiles"
MESH_ARGS=(--geojson "$JOINED" --out-dir "$MESH_DIR")
if [ "$LIMIT" -gt 0 ]; then MESH_ARGS+=(--limit "$LIMIT"); fi
python3 scripts/geospatial/build-building-3d-tiles.py "${MESH_ARGS[@]}"

echo "=== 4. HLOD ==="
python3 scripts/geospatial/build-building-hlod.py \
  --tileset "$MESH_DIR/tileset.json" \
  --out-dir tsm-console/public/data/buildings-3d-tiles-hlod

echo "=== 5. Draco (optional) ==="
if command -v gltfpack >/dev/null 2>&1; then
  for g in tsm-console/public/data/buildings-3d-tiles-hlod/*.glb; do
    [ -f "$g" ] || continue
    gltfpack -i "$g" -o "${g%.glb}.draco.glb" -cc || true
  done
  echo "[INFO] gltfpack Draco pass done (evidence twin remains uncompressed .glb)"
else
  echo "[INFO] gltfpack not installed; skip Draco"
fi

echo "=== 6. Validate ==="
bash scripts/geospatial/validate-building-tiles.sh \
  tsm-console/public/data/buildings-3d-tiles-hlod

echo "=== 7. Publish ==="
bash scripts/geospatial/publish-building-tiles.sh \
  tsm-console/public/data/buildings-3d-tiles-hlod \
  tsm-console/public/data/buildings-3d-tiles

echo "=== PIPELINE COMPLETE ==="
echo "  Footprints: $FOOT"
echo "  Joined:     $JOINED"
echo "  Tiles:      tsm-console/public/data/buildings-3d-tiles/tileset.json"
echo "  Inventory:  data/buildings/PUBLISH_INVENTORY.json"
