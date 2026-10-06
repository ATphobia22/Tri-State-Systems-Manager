#!/usr/bin/env bash
set -euo pipefail
INPUT=${1:?input}; OUTPUT=${2:?output}; BIN=${GLTF_TRANSFORM_BIN:-tsm-console/node_modules/.bin/gltf-transform}
rm -rf "$OUTPUT"; mkdir -p "$OUTPUT"
cp "$INPUT/tileset.json" "$OUTPUT/tileset.json"; cp "$INPUT/manifest.json" "$OUTPUT/manifest.json"
while IFS= read -r -d '' src; do
 rel=${src#"$INPUT/"}; dst="$OUTPUT/${rel%.glb}-draco.glb"; mkdir -p "$(dirname "$dst")"
 "$BIN" draco "$src" "$dst" --method edgebreaker --encode-speed 5 --decode-speed 5 --quantize-position 14 --quantize-normal 10
done < <(find "$INPUT" -type f -path '*/stitched/*.glb' -print0 | sort -z)
python3 - "$OUTPUT" <<'PY'
import json,sys
from pathlib import Path
r=Path(sys.argv[1]); p=r/"tileset.json"; ts=json.loads(p.read_text())
def walk(n):
 c=n.get("content",{}); u=c.get("uri")
 if isinstance(u,str) and u.startswith("stitched/") and u.endswith(".glb"): c["uri"]=u[:-4]+"-draco.glb"
 for x in n.get("children",[]): walk(x)
walk(ts["root"]); ts.setdefault("extras",{}).setdefault("tsm",{})["draco"]=True
p.write_text(json.dumps(ts,separators=(",",":"))+"\n")
PY

(cd "$OUTPUT" && find . -type f ! -name 'SHA256SUMS' -printf '%P\n' | sort | while IFS= read -r file; do sha256sum "$file"; done > SHA256SUMS)
