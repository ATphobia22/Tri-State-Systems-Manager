#!/usr/bin/env bash
set -euo pipefail
IFC="${1:?IFC path required}"
OUT="${2:-data/citygml/$(basename "${IFC%.*}")_citygml3.gml}"
mkdir -p "$(dirname "$OUT")"
if command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -v "$(cd "$(dirname "$IFC")" && pwd):/in:ro" \
    -v "$(cd "$(dirname "$OUT")" && pwd):/out" \
    ghcr.io/tum-gis/ifc-to-citygml3:latest \
    "/in/$(basename "$IFC")" -o "/out/$(basename "$OUT")"
elif python3 -c "import ifcopenshell" 2>/dev/null; then
  python3 -m ifc2citygml "$IFC" -o "$OUT" 2>/dev/null || true
else
  echo "SKIP: docker ghcr.io/tum-gis/ifc-to-citygml3 or ifcopenshell"
  exit 1
fi
echo "CityGML: $OUT"
