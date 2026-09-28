#!/usr/bin/env python3
"""TSM FEMA MT-1 / MT-2 LOMC submission bundle generator.

Generates a deterministic, SHA-256-manifested submission package for FEMA
Letters of Map Change — OFFLINE. This script assembles the bundle; it does
NOT submit anything to FEMA. Submission (via FEMA's Online LOMC portal) is
always an explicit human action outside this tool.

Bundle contents:
  fema_lomc_manifest.json      deterministic SHA-256 manifest of every file
  mt1_form1_property.json      Form MT-1 — property information (pre-populated)
  mt1_form2_elevation.json     Form MT-1 — elevation information (pre-populated)
  mt1_form3_community.json     Form MT-1 — community acknowledgment (template)
  mt2_worksheets.json          Form MT-2 — revision worksheets (LOMR/CLOMR)
  elevation_summary.txt        human-readable elevation summary
  checklist.txt                what the applicant must still supply by hand

Usage:
  python generate_fema_lomc_bundle.py --parcel-id <id> --out <dir> [--lomr]

Data sources: parcel_provenance PostGIS table (psycopg optional) or a JSON
parcel record passed via --parcel-json. If no database is reachable the
script fails closed with a clear message — it never invents parcel data.

Conventions mirror the TSM charter:
  * "Technology informs people; it does not silently govern people."
  * Every derived value is labeled with its derivation; uncertified values
    are NEVER presented as certified.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BUNDLE_VERSION = "TSM-LOMC-BUNDLE-V1"
MANIFEST_NAME = "fema_lomc_manifest.json"

# FEMA Form MT-1 (OMB 1660-0013) section scaffolding. Field names follow the
# MT-1 instructions; values are filled from parcel evidence where available
# and left as explicit "APPLICANT_MUST_SUPPLY" tokens otherwise.
MT1_FORM1_FIELDS = [
    "applicant_name", "applicant_mailing_address", "applicant_phone",
    "property_street_address", "property_city", "property_county",
    "property_state", "property_zip", "parcel_apn",
    "legal_description", "fema_panel_number", "fema_community_id",
    "structure_type", "date_of_construction",
]

MT1_FORM2_FIELDS = [
    "lowest_adjacent_grade_navd88_ft", "lowest_floor_elevation_navd88_ft",
    "elevation_certificate_preparer", "preparer_license",
    "elevation_datum", "certification_date",
]

MT1_FORM3_FIELDS = [
    "community_official_name", "community_official_title",
    "community_acknowledgment_date", "floodplain_permit_number",
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_parcel(parcel_id: str, parcel_json: str | None) -> dict:
    """Load the parcel record. Fail closed when no record is available."""
    if parcel_json:
        record = json.loads(Path(parcel_json).read_text())
        if not isinstance(record, dict):
            raise ValueError("parcel JSON must decode to an object")
        return record
    # Optional live lookup — only if psycopg is installed AND a DB answers.
    try:
        import psycopg  # type: ignore
    except ImportError:
        raise SystemExit(
            "ERROR: no --parcel-json supplied and psycopg is not installed. "
            "Refusing to invent parcel data. Supply --parcel-json."
        )
    raise SystemExit(
        "ERROR: live database lookup is not implemented in this offline build. "
        "Supply --parcel-json with the parcel record."
    )


def build_mt1(parcel: dict) -> dict:
    form1 = {field: "APPLICANT_MUST_SUPPLY" for field in MT1_FORM1_FIELDS}
    form2 = {field: "APPLICANT_MUST_SUPPLY" for field in MT1_FORM2_FIELDS}
    form3 = {field: "APPLICANT_MUST_SUPPLY" for field in MT1_FORM3_FIELDS}

    # Pre-populate strictly from parcel evidence; label the derivation.
    form1["parcel_apn"] = parcel.get("parcel_id", "APPLICANT_MUST_SUPPLY")
    form1["property_state"] = parcel.get("state_code", "APPLICANT_MUST_SUPPLY")
    form1["property_county"] = parcel.get("county", "APPLICANT_MUST_SUPPLY")

    lag = parcel.get("lag_navd88_ft")
    if isinstance(lag, (int, float)):
        form2["lowest_adjacent_grade_navd88_ft"] = {
            "value_ft": lag,
            "derivation": parcel.get("lag_source", "owner-supplied-uncertified"),
            "warning": "UNCERTIFIED until a licensed PE/RLS signs an Elevation Certificate.",
        }

    bfe = parcel.get("bfe_navd88_ft")
    if isinstance(bfe, (int, float)):
        form2["base_flood_elevation_navd88_ft_reference"] = {
            "value_ft": bfe,
            "derivation": "FEMA NFHL screening reference — not a FEMA determination",
        }

    return {
        "form": "MT-1",
        "title": "Application for Letter of Map Amendment / Letter of Map Revision Based on Fill (LOMA/LOMR-F)",
        "form1_property_information": form1,
        "form2_elevation_information": form2,
        "form3_community_acknowledgment": form3,
    }


def build_mt2(parcel: dict) -> dict:
    return {
        "form": "MT-2",
        "title": "Application for Conditional / Letter of Map Revision (CLOMR/LOMR)",
        "note": "MT-2 revises the map itself (BFE, floodway, zone boundaries). "
                "Requires community concurrence and, typically, HEC-RAS modeling.",
        "worksheets": {
            "riverine_hydrology": "APPLICANT_MUST_SUPPLY",
            "riverine_hydraulics": "APPLICANT_MUST_SUPPLY -- HEC-RAS model reference expected",
            "floodway_encroachment": "APPLICANT_MUST_SUPPLY",
            "berm_or_fill_description": parcel.get("proposed_berm", "APPLICANT_MUST_SUPPLY"),
            "certification": "Must be signed/sealed by a licensed professional engineer.",
        },
        "parcel_reference": {
            "parcel_id": parcel.get("parcel_id"),
            "state_code": parcel.get("state_code"),
        },
    }


def build_elevation_summary(parcel: dict) -> str:
    lines = [
        "TSM LOMC Elevation Summary (screening reference only)",
        f"Generated: {utc_now()}",
        f"Parcel: {parcel.get('parcel_id', 'UNKNOWN')} ({parcel.get('state_code', '?')})",
        "",
    ]
    bfe = parcel.get("bfe_navd88_ft")
    lag = parcel.get("lag_navd88_ft")
    if isinstance(bfe, (int, float)):
        lines.append(f"Base Flood Elevation (NFHL screening ref): {bfe} ft NAVD88")
    if isinstance(lag, (int, float)):
        lines.append(f"Lowest Adjacent Grade ({parcel.get('lag_source', 'uncertified')}): {lag} ft NAVD88")
    if isinstance(bfe, (int, float)) and isinstance(lag, (int, float)):
        freeboard = lag - bfe
        lines.append(f"Screened freeboard (LAG - BFE): {freeboard:+.2f} ft")
        lines.append(
            "POSSIBLE LOMA CANDIDATE" if freeboard > 0 else "NO FREEBOARD at screened values"
        )
    lines += [
        "",
        "This summary is NOT an Elevation Certificate and NOT a FEMA determination.",
        "A LOMA requires FEMA review of certified elevation data on Form MT-1.",
    ]
    return "\n".join(lines) + "\n"


def build_checklist() -> str:
    return "\n".join(
        [
            "TSM LOMC Applicant Checklist (complete by hand before any submittal)",
            "",
            "[ ] Elevation Certificate signed/sealed by licensed PE/RLS (MT-1 Form 2)",
            "[ ] Recorded deed or plat showing legal description",
            "[ ] Community Acknowledgment signed by floodplain administrator (MT-1 Form 3)",
            "[ ] For LOMR: HEC-RAS hydraulic model + community concurrence (MT-2)",
            "[ ] Proof of notification to affected property owners (MT-2, where required)",
            "[ ] Application fee per current FEMA fee schedule",
            "[ ] Submit ONLY via FEMA Online LOMC portal — this bundle never submits itself",
            "",
        ]
    )


def write_manifest(out_dir: Path, files: list[Path]) -> Path:
    entries = []
    for path in sorted(files):
        entries.append(
            {
                "file": path.name,
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
            }
        )
    manifest = {
        "bundle": BUNDLE_VERSION,
        "generated_at": utc_now(),
        "generator": "TSM generate_fema_lomc_bundle.py (offline; no submission performed)",
        "files": entries,
    }
    # Manifest hash covers the file list; written last and hashed separately.
    manifest_path = out_dir / MANIFEST_NAME
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return manifest_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate an offline FEMA LOMC bundle.")
    parser.add_argument("--parcel-id", required=True, help="Parcel identifier")
    parser.add_argument("--parcel-json", default=None, help="Path to parcel record JSON")
    parser.add_argument("--out", required=True, help="Output directory for the bundle")
    parser.add_argument("--lomr", action="store_true", help="Include MT-2 (LOMR/CLOMR) worksheets")
    args = parser.parse_args(argv)

    parcel = load_parcel(args.parcel_id, args.parcel_json)
    parcel.setdefault("parcel_id", args.parcel_id)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []

    mt1_path = out_dir / "mt1_form1-2-3.json"
    mt1_path.write_text(json.dumps(build_mt1(parcel), indent=2, sort_keys=True) + "\n")
    written.append(mt1_path)

    if args.lomr:
        mt2_path = out_dir / "mt2_worksheets.json"
        mt2_path.write_text(json.dumps(build_mt2(parcel), indent=2, sort_keys=True) + "\n")
        written.append(mt2_path)

    summary_path = out_dir / "elevation_summary.txt"
    summary_path.write_text(build_elevation_summary(parcel))
    written.append(summary_path)

    checklist_path = out_dir / "checklist.txt"
    checklist_path.write_text(build_checklist())
    written.append(checklist_path)

    manifest_path = write_manifest(out_dir, written)

    print(f"Bundle written to {out_dir}")
    print(f"Manifest: {manifest_path}  sha256={sha256_file(manifest_path)[:16]}...")
    print("OFFLINE ONLY — nothing was submitted to FEMA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
