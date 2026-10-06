#!/usr/bin/env bash
# Structural validation for building 3D Tiles / GLB outputs.
# Optional: install gltf-validator (npm i -g gltf-validator) for deeper checks.
set -euo pipefail

TILE_DIR="${1:-tsm-console/public/data/buildings-3d-tiles}"
FAILED=0

echo "[VALIDATE] Building tiles directory: $TILE_DIR"
if [ ! -d "$TILE_DIR" ]; then
  echo "[FAIL] directory missing"
  exit 1
fi

if [ ! -f "$TILE_DIR/tileset.json" ]; then
  echo "[FAIL] tileset.json missing"
  exit 1
fi

# JSON parse
python3 -c "import json; json.load(open('$TILE_DIR/tileset.json'))" || {
  echo "[FAIL] tileset.json invalid JSON"
  exit 1
}
echo "[PASS] tileset.json parses"

# Required authority extras
python3 - <<'PY'
import json, sys
ts = json.load(open(sys.argv[1]))
extras = (ts.get("asset") or {}).get("extras") or {}
tsm = extras.get("tsm") or {}
if tsm.get("engineeringUse") is True or tsm.get("regulatoryUse") is True:
    print("[FAIL] engineering/regulatory flags must be false for derived buildings")
    sys.exit(1)
if tsm.get("authorityClass") not in ("DERIVED", None):
    print("[FAIL] authorityClass must be DERIVED")
    sys.exit(1)
print("[PASS] authority extras")
PY
"$TILE_DIR/tileset.json"

# GLB magic header
shopt -s nullglob
glbs=("$TILE_DIR"/*.glb)
if [ ${#glbs[@]} -eq 0 ]; then
  echo "[WARN] no .glb files"
else
  for g in "${glbs[@]}"; do
    magic=$(head -c 4 "$g" || true)
    if [ "$magic" != "glTF" ]; then
      echo "[FAIL] bad GLB magic: $g"
      FAILED=$((FAILED + 1))
    fi
  done
  echo "[PASS] ${#glbs[@]} GLB magic headers"
fi

# Optional gltf-validator
if command -v gltf-validator >/dev/null 2>&1; then
  for g in "${glbs[@]}"; do
    if ! gltf-validator "$g" >/dev/null 2>&1; then
      echo "[FAIL] gltf-validator: $g"
      FAILED=$((FAILED + 1))
    fi
  done
  echo "[INFO] gltf-validator completed"
else
  echo "[INFO] gltf-validator not installed; skipped"
fi

if [ -f "$TILE_DIR/SHA256SUMS" ]; then
  echo "[PASS] SHA256SUMS present"
else
  echo "[WARN] SHA256SUMS missing"
fi

if [ "$FAILED" -gt 0 ]; then
  echo "[ERROR] $FAILED validation failure(s)"
  exit 1
fi
echo "[SUCCESS] building tiles structural validation OK"
