#!/usr/bin/env bash
set -euo pipefail
INPUT=${1:?validated tile directory}; OUT=${2:?artifact directory}; VERSION=${3:?version}; SHA=${4:?git sha}
mkdir -p "$OUT"; ZIP="$OUT/tsm-buildings-3d-tiles-$VERSION-$SHA.zip"; rm -f "$ZIP" "$ZIP.sha256"
python3 - "$INPUT" <<'PY'
import hashlib,json,sys
from pathlib import Path
r=Path(sys.argv[1]); m=json.loads((r/"manifest.json").read_text())
if m.get("authorityClass")!="DERIVED" or m.get("engineeringUse") is not False or m.get("regulatoryUse") is not False: raise SystemExit("invalid authority boundary")
paths=sorted(p for p in r.rglob("*") if p.is_file() and p.name!="SHA256SUMS")
(r/"SHA256SUMS").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(r).as_posix()}\n" for p in paths))
PY
(cd "$INPUT" && zip -qr "$ZIP" .); sha256sum "$ZIP" > "$ZIP.sha256"
