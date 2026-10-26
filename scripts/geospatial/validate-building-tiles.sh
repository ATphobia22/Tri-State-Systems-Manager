#!/usr/bin/env bash
# Informational structural preflight, not a countywide 3D Tiles acceptance gate.
# Usage: bash scripts/geospatial/validate-building-tiles.sh /path/to/tileset-root
set -euo pipefail

TILE_DIR="${1:-tsm-console/public/3d-tiles}"
if [[ ! -d "$TILE_DIR" || ! -f "$TILE_DIR/tileset.json" ]]; then
  echo "[FAIL] tileset root or tileset.json missing: $TILE_DIR" >&2
  exit 1
fi

# Pass the filename as an argument: the original heredoc put this on a
# separate shell line, trying to EXECUTE tileset.json after Python exited.
python3 - "$TILE_DIR/tileset.json" <<'PY'
import json
import sys
from pathlib import Path

p = Path(sys.argv[1])
ts = json.loads(p.read_text(encoding="utf-8"))
if not isinstance(ts, dict) or not isinstance(ts.get("asset"), dict):
    raise SystemExit("[FAIL] missing 3D Tiles asset object")
if str(ts["asset"].get("version", "")) not in {"1.0", "1.1"}:
    raise SystemExit("[FAIL] unrecognized 3D Tiles asset version")
extras = ts["asset"].get("extras") or {}
tsm = extras.get("tsm") or {}
if tsm.get("engineeringUse") is True or tsm.get("regulatoryUse") is True:
    raise SystemExit("[FAIL] derived 3D geometry cannot claim engineering/regulatory authority")
if tsm.get("authorityClass") not in ("DERIVED", None):
    raise SystemExit("[FAIL] unexpected 3D building authority class")
print("[PASS] tileset JSON, version and authority preflight")
PY

# Recursively inspect nested GLB files, not just root-level *.glb.
# A GLB header is necessary but not sufficient for full glTF conformance.
count=0
while IFS= read -r -d '' glb; do
  python3 - "$glb" <<'PY'
import struct, sys
from pathlib import Path
p = Path(sys.argv[1])
with p.open("rb") as fh:
    header = fh.read(12)
if len(header) != 12 or header[:4] != b"glTF":
    raise SystemExit(f"[FAIL] invalid GLB magic/header: {p}")
version, declared = struct.unpack("<II", header[4:])
if version != 2 or declared != p.stat().st_size:
    raise SystemExit(f"[FAIL] invalid GLB version or declared byte length: {p}")
PY
  count=$((count + 1))
done < <(find "$TILE_DIR" -type f -iname '*.glb' -print0)
if [[ "$count" -eq 0 ]]; then
  echo "[FAIL] no GLB payloads; cannot assert GLB content validation" >&2
  exit 1
fi
echo "[PASS] $count GLB headers and declared sizes"

if command -v gltf_validator >/dev/null 2>&1; then
  echo "[INFO] Khronos gltf_validator available; run full recursive directory validation separately"
elif command -v gltf-validator >/dev/null 2>&1; then
  echo "[INFO] gltf-validator available; run full recursive directory validation separately"
else
  echo "[WARN] Khronos glTF-Validator unavailable; structural preflight only"
fi

echo "[PASS] Structural preflight only; OGC 3D Tiles, complete 23,082 identities, roof heights, terrain, and clean-client render acceptance remain separate gates"
