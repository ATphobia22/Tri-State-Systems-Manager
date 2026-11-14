#!/usr/bin/env bash
# Apply glTF 2.0 EXT_meshopt_compression via glTF-Transform.
# Usage: meshopt-glb.sh input.glb [output.glb]
set -euo pipefail
IN="${1:?input.glb required}"
OUT="${2:-${IN%.glb}.meshopt.glb}"
if ! command -v gltf-transform >/dev/null 2>&1; then
  echo "Install: npm i -g @gltf-transform/cli" >&2
  exit 1
fi
gltf-transform meshopt "$IN" "$OUT" --level medium
echo "Wrote $OUT"
