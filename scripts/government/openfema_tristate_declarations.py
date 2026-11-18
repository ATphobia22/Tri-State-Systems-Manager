#!/usr/bin/env python3
"""Optional network-backed, six-county OpenFEMA declaration snapshot export.

This export DOES NOT retrieve FEMA FIRM/NFHL, historic inundation polygons,
NFIP person-level claims, BFE or building geometry. Snapshots are administrative.
All six bounded paginated queries must complete before anything is written.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from backend.geospatial.fema import openfema_client as openfema  # noqa: E402

# FIPS county codes are strings: IL Gallatin must retain leading 0.
COUNTY_FILTERS = {
    "18129": ("IN", "129", "Posey County"),
    "21101": ("KY", "101", "Henderson County"),
    "21225": ("KY", "225", "Union County"),
    "17059": ("IL", "059", "Gallatin County"),
    "17185": ("IL", "185", "Wabash County"),
    "17193": ("IL", "193", "White County"),
}
SELECT = (
    "id,disasterNumber,state,fipsCountyCode,declarationDate,"
    "incidentBeginDate,incidentEndDate,incidentType,declarationTitle,"
    "designatedArea,ihProgramDeclared,iaProgramDeclared,"
    "paProgramDeclared,hmProgramDeclared"
)
_ALLOWED = set(SELECT.split(","))


def _snapshot_county(fips: str, query) -> dict:
    if fips not in COUNTY_FILTERS:
        raise ValueError("Unsupported county FIPS")
    state, county_code, name = COUNTY_FILTERS[fips]
    odata_filter = f"state eq '{state}' and fipsCountyCode eq '{county_code}'"
    response = query(
        "DisasterDeclarationsSummaries",
        odata_filter=odata_filter, select=SELECT, orderby="declarationDate desc",
        top=100, max_pages=5, max_records=500,
    )
    if response.get("status") != "OBSERVED" or response.get("complete") is not True:
        raise ValueError(f"{fips}: incomplete or unavailable OpenFEMA response")
    if response.get("apiVersion") != 2 or response.get("deprecatedDataset") is True:
        raise ValueError(f"{fips}: unexpected OpenFEMA dataset version")
    rows = response.get("records")
    pages = response.get("page_receipts")
    if not isinstance(rows, list) or not isinstance(pages, list):
        raise ValueError(f"{fips}: records and receipts must be lists")
    if len(rows) and not pages:
        raise ValueError(f"{fips}: missing response page receipts")
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"{fips}: malformed record {i}")
        if row.get("state") != state or str(row.get("fipsCountyCode", "")).zfill(3) != county_code:
            raise ValueError(f"{fips}: unexpected county in record {i}")
        if set(row) - _ALLOWED:
            raise ValueError(f"{fips}: unexpected field in record {i}")
        if not isinstance(row.get("id"), str) or not row["id"]:
            raise ValueError(f"{fips}: missing OpenFEMA record identifier {i}")
        if not isinstance(row.get("disasterNumber"), int):
            raise ValueError(f"{fips}: missing federal declaration number {i}")
    for i, page in enumerate(pages):
        if not isinstance(page, dict):
            raise ValueError(f"{fips}: invalid page receipt {i}")
        digest = page.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(
                char not in "0123456789abcdefABCDEF" for char in digest):
            raise ValueError(f"{fips}: missing page SHA-256 receipt {i}")
        if not str(page.get("url", "")).startswith(
                "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries"):
            raise ValueError(f"{fips}: receipt URL source mismatch")
    return {
        "schema": "tsm-openfema-tristate-declaration-snapshot",
        "version": "1.0.0",
        "countyFips": fips,
        "countyName": name,
        "sourceAuthority": "FEMA OpenFEMA",
        "endpoint": "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries",
        "queryFilter": odata_filter,
        "select": SELECT,
        "queryOrder": "declarationDate desc",
        "retrievedAtUtc": response.get("retrieved_at"),
        "apiVersion": response["apiVersion"],
        "pageReceipts": pages,
        "recordCount": len(rows),
        "completeness": "BOUNDED_QUERY_COMPLETE",
        "complete": True,
        "spatialAuthority": "NONE_ADMINISTRATIVE",
        "parcelFloodingConfirmed": False,
        "buildingFootprintsAvailable": False,
        "regulatoryBfeAvailable": False,
        "eventMapUseVerified": False,
        "observations": rows,
        "limitations": [
            "A disaster declaration is not proof any individual parcel flooded",
            "The record's designated area is not a mapped flood extent",
            "Publication date is not necessarily an event's start or local flood crest",
            "Historical FIRM and BFE evidence must be retrieved from FEMA MSC separately",
            "No redacted NFIP claim or policy joins to a building or address",
            "Bounded $top/$skip pagination can reflect source updates between pages",
            "No building footprints, LAG, FFE, water-surface elevation or regulatory BFE in export",
        ],
    }


def make_all_snapshots(query=openfema.query_dataset) -> dict[str, dict]:
    docs = {}
    for fips in COUNTY_FILTERS:
        docs[fips] = _snapshot_county(fips, query)
    return docs


def save_snapshots(documents: dict[str, dict], out: Path) -> list[Path]:
    if set(documents) != set(COUNTY_FILTERS):
        raise ValueError("All six counties must be represented")
    if out.is_symlink() or (out.exists() and (
            not out.is_dir() or any(out.iterdir()))):
        raise FileExistsError("Destination must be a new or empty directory")
    out.mkdir(parents=True, exist_ok=True)
    files = []
    for fips in COUNTY_FILTERS:
        path = out / f"openfema-declarations-{fips}.json"
        raw = (json.dumps(documents[fips], sort_keys=True, indent=2,
                          ensure_ascii=False) + "\n").encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()
        with path.open("xb") as stream:
            stream.write(raw)
        with Path(str(path) + ".sha256").open("x", encoding="ascii") as receipt:
            receipt.write(digest + "  " + path.name + "\n")
        files.append(path)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        docs = make_all_snapshots()
        files = save_snapshots(docs, args.out)
        print(json.dumps({"status": "SIX_COMPLETE_ADMINISTRATIVE_SNAPSHOTS",
                          "files": [str(path) for path in files]}, indent=2))
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print("Cross-state OpenFEMA export withheld: " + str(error),
              file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
