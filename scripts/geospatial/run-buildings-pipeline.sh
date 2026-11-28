#!/usr/bin/env bash
set -euo pipefail

# Production Posey building reconstruction. The expected footprint count is
# obtained ONLY from a fresh official receipt tied to the exact source bytes.
# Historical 23,082 snapshot data are never a production cardinality default.
ROOT=${1:-/tmp/tsm-buildings}
GEOJSON=${2:-/tmp/tsm-igio/posey-buildings-igio-enriched.geojson}
: "${POSEY_OFFICIAL_SOURCE_RECEIPT:?Provide fresh posey_official_inventory.py --snapshot receipt}"
: "${POSEY_OFFICIAL_SOURCE_GEOJSON:?Provide GeoJSON matching official receipt snapshot SHA-256}"

EXPECTED_BUILDINGS=$(python3 - "$POSEY_OFFICIAL_SOURCE_RECEIPT" "$POSEY_OFFICIAL_SOURCE_GEOJSON" <<'PY'
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, "scripts/geospatial")
from reconcile_published_buildings import _inventory

receipt_path, source_path = map(Path, sys.argv[1:])
receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
source = _inventory(source_path)
snapshot = receipt.get("snapshot") or {}
if (receipt.get("schema_version") != "tsm.indiana-posey-source-inventory.v1"
    or receipt.get("source") != "https://gisdata.in.gov/server/rest/services/Hosted/Building_Footprints/FeatureServer/0"
    or receipt.get("source_filter") != "county='Posey'"
    or receipt.get("source_identity_complete") is not True
    or receipt.get("geometry_download_complete") is not True
    or receipt.get("local_snapshot_identity_complete") is not True
    or snapshot.get("identity_complete") is not True
    or snapshot.get("sha256") != source["sha256"]
    or source["without_id"] or source["invalid_features"] or source["duplicate_ids"]
    or source["count"] != receipt.get("official_feature_count")
    or source["count"] < 1):
    raise SystemExit("FAIL: fresh official inventory receipt / exact source bytes are incomplete")
ids = sorted(source["ids"])
identity_sha = hashlib.sha256(
    (json.dumps(ids, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")
).hexdigest()
if identity_sha != receipt.get("official_sorted_objectids_sha256"):
    raise SystemExit("FAIL: official OBJECTID set digest differs from matching source")
pages = receipt.get("downloaded_geometry_pages")
if not isinstance(pages, list) or not pages or sum(
        page.get("object_id_count", 0) for page in pages) != source["count"]:
    raise SystemExit("FAIL: official geometry page inventory not complete")
print(source["count"])
PY
)

mkdir -p "$(dirname "$GEOJSON")"
if [[ ! -s "$GEOJSON" ]]; then
  python3 scripts/geospatial/acquire-and-enrich-igio-posey-buildings.py \
    --output "$GEOJSON" --expected-count "$EXPECTED_BUILDINGS" --require-live
fi

# Exact source identity, not count-only equality. This audit is informational
# about footprint IDs and does NOT claim height, mesh, or datum accuracy.
python3 scripts/geospatial/reconcile_published_buildings.py \
  --published "$GEOJSON" --authoritative "$POSEY_OFFICIAL_SOURCE_GEOJSON" \
  --require-complete

EXPECTED_BUILDINGS="$EXPECTED_BUILDINGS" \
  bash scripts/geospatial/build-building-3d-tiles-pipeline.sh "$ROOT" "$GEOJSON"
