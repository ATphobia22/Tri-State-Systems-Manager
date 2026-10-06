#!/usr/bin/env bash
# Copy validated building 3D Tiles into the SPA public path + write inventory.
set -euo pipefail

SRC="${1:-tsm-console/public/data/buildings-3d-tiles-hlod}"
DEST="${2:-tsm-console/public/data/buildings-3d-tiles}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$ROOT"
if [ ! -d "$SRC" ]; then
  echo "[ERROR] source missing: $SRC (run mesh + hlod first)"
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/" 2>/dev/null || cp -a "$SRC"/. "$DEST"/

# Inventory artifact at repo data/ for release gate
INV="data/buildings/PUBLISH_INVENTORY.json"
mkdir -p data/buildings
python3 - <<PY
import hashlib, json, os
from pathlib import Path
dest = Path("$DEST")
files = sorted(p for p in dest.rglob("*") if p.is_file())
entries = []
for p in files:
    entries.append({
        "path": str(p.relative_to(dest)),
        "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        "bytes": p.stat().st_size,
    })
inv = {
    "artifactId": "tsm-buildings-3d-tiles-published",
    "dest": "$DEST",
    "fileCount": len(entries),
    "files": entries,
    "authorityClass": "DERIVED",
    "engineeringUse": False,
    "regulatoryUse": False,
    "consoleLoadPath": "/data/buildings-3d-tiles/tileset.json",
}
Path("$INV").write_text(json.dumps(inv, indent=2) + "\n")
print(f"inventory -> $INV ({len(entries)} files)")
PY

echo "[SUCCESS] published $SRC -> $DEST"
echo "  Console path: /data/buildings-3d-tiles/tileset.json"
