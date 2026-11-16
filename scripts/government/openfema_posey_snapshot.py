#!/usr/bin/env python3
"""Create a bounded, FEMA-sourced Posey County declaration snapshot.

Explicit network operation. Does not create NFHL polygon geometry, regulatory
determinations, flood WSE, or grant eligibility. Requires a COMPLETE OpenFEMA
response and validates every returned county/state before writing artifacts.
Only a small allowlist of historical disaster declaration fields is exported.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.geospatial.fema import openfema_client as fema  # noqa: E402

SELECT = (
    "id,disasterNumber,state,fipsCountyCode,declarationDate,incidentType,"
    "declarationTitle,designatedArea,ihProgramDeclared,iaProgramDeclared,"
    "paProgramDeclared,hmProgramDeclared"
)
FILTER = "state eq 'IN' and fipsCountyCode eq '129'"


def make_snapshot(query=fema.query_dataset) -> dict:
    result = query(
        "DisasterDeclarationsSummaries", odata_filter=FILTER, select=SELECT,
        orderby="declarationDate desc", top=100, max_pages=5, max_records=500,
    )
    if result.get("status") != "OBSERVED" or result.get("complete") is not True:
        raise ValueError("Refusing partial/unavailable OpenFEMA input")
    rows = result.get("records")
    if not isinstance(rows, list) or not rows:
        raise ValueError("Refusing missing or empty Posey history without manual source review")
    for i, rec in enumerate(rows):
        if not isinstance(rec, dict) or rec.get("state") != "IN" or (
            str(rec.get("fipsCountyCode", "")).zfill(3) != "129"
        ):
            raise ValueError(f"Row {i}: record does not match Posey County")
        if not isinstance(rec.get("disasterNumber"), int):
            raise ValueError(f"Row {i}: absent disaster number")
        if not isinstance(rec.get("id"), str) or not rec["id"]:
            raise ValueError(f"Row {i}: missing source record ID")
        if set(rec) - set(SELECT.split(",")):
            raise ValueError(f"Row {i}: unexpected or potentially sensitive fields")
    return {
        "schema": "tsm-openfema-posey-disaster-snapshot",
        "version": "1.0.0",
        "sourceAuthority": "FEMA OpenFEMA",
        "endpoint": "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
        "dataset": "DisasterDeclarationsSummaries",
        "femaFilter": FILTER,
        "femaSelect": SELECT,
        "femaOrderBy": "declarationDate desc",
        "retrievedAtUtc": result["retrieved_at"],
        "sourcePages": result["page_receipts"],
        "sourceDatasetDeprecated": result["deprecatedDataset"],
        "recordCount": len(rows),
        "completeness": "BOUNDED_QUERY_COMPLETE",
        "spatialAuthority": "NONE_OPENFEMA_ADMINISTRATIVE_CONTEXT",
        "regulatoryFloodGeometry": False,
        "independentEngineeringVerification": False,
        "observations": rows,
        "limitations": [
            "FEMA administrative records may contain errors or be revised by FEMA",
            "County designation is not a parcel's flood probability or NFHL map",
            "No flood depth, recurrence interval, property loss, or grant eligibility inferred",
            "Published count is a time-bounded query snapshot, not a live value",
        ],
    }


def save_snapshot(doc: dict, output: Path) -> tuple[str, Path]:
    if output.is_symlink() or output.exists():
        raise ValueError("Output path already exists; do not silently overwrite evidence")
    sidecar = Path(str(output) + ".sha256")
    if sidecar.exists() or sidecar.is_symlink():
        raise ValueError("Receipt sidecar already exists")
    output.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    with output.open("xb") as stream:
        stream.write(raw)
    with sidecar.open("x", encoding="ascii") as stream:
        stream.write(digest + "  " + output.name + "\n")
    return digest, sidecar


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path,
                        help="New output JSON file, no overwrite")
    options = parser.parse_args()
    try:
        doc = make_snapshot()
        digest, sidecar = save_snapshot(doc, options.out)
        print(json.dumps({"status": "SOURCE_SNAPSHOT_SAVED",
                          "recordCount": doc["recordCount"],
                          "sha256": digest, "sidecar": str(sidecar)}, indent=2))
        return 0
    except (OSError, ValueError) as error:
        print(f"OpenFEMA snapshot not published: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
