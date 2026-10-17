#!/usr/bin/env python3
"""Validate committed hydraulic-model ZIP archives without launching a solver.

This is an archive-integrity and metadata-discovery gate, not a HEC-RAS solver
validation, spatial-overlap determination, or engineering approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

ARCHIVE_ROOT = Path("data/fabrics/hydraulic-models")
TEXT_SUFFIXES = {".prj", ".txt", ".dat", ".xml", ".csv", ".rasmap", ".ini"}
HECRAS_SUFFIX = re.compile(r"^\.(?:g|f|p|u|r|o)\d{2}$", re.IGNORECASE)
EPSG_RE = re.compile(r"\bEPSG\s*[:=]?\s*(\d{4,6})\b", re.IGNORECASE)
CRS_RE = re.compile(
    r"\b(?:NAD\s*83|NAD83|NAD\s*27|WGS\s*84|WGS84|UTM\s*(?:ZONE)?\s*\d{1,2}[NS]?|"
    r"STATE\s*PLANE|PROJCS|GEOGCS|COORDINATE\s+SYSTEM|PROJECTION)\b",
    re.IGNORECASE,
)
VERTICAL_RE = re.compile(
    r"\b(?:NAVD\s*88|NAVD88|NGVD\s*(?:29|1929)|NGVD29|GEOID\s*\d{2,4}|VERTICAL\s+DATUM|"
    r"VERTICAL\s+UNITS?)\b",
    re.IGNORECASE,
)
MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024
MAX_MEMBER_BYTES = 1024 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_member_name(name: str) -> bool:
    normalized = name.replace("\\", "/")
    member = PurePosixPath(normalized)
    return (
        not member.is_absolute()
        and not any(part in {"..", ""} for part in member.parts)
        and not re.match(r"^[A-Za-z]:", normalized)
    )


def extract_text_evidence(archive: zipfile.ZipFile, names: list[str]) -> dict[str, list[str]]:
    crs_evidence: list[str] = []
    vertical_evidence: list[str] = []
    epsg_codes: set[str] = set()
    for name in names:
        path = PurePosixPath(name)
        suffix = path.suffix.lower()
        if suffix not in TEXT_SUFFIXES and not HECRAS_SUFFIX.match(suffix):
            continue
        try:
            info = archive.getinfo(name)
            if info.file_size > MAX_TEXT_SCAN_BYTES:
                continue
            raw = archive.read(name)
            text = raw.decode("utf-8", errors="ignore")
        except (KeyError, OSError, RuntimeError, zipfile.BadZipFile):
            continue
        for match in EPSG_RE.finditer(text):
            epsg_codes.add(match.group(1))
        for line in text.splitlines():
            clipped = line.strip()[:240]
            if clipped and CRS_RE.search(clipped) and len(crs_evidence) < 30:
                crs_evidence.append(f"{name}: {clipped}")
            if clipped and VERTICAL_RE.search(clipped) and len(vertical_evidence) < 30:
                vertical_evidence.append(f"{name}: {clipped}")
    return {
        "epsg_codes": sorted(epsg_codes),
        "crs_evidence": crs_evidence,
        "vertical_datum_evidence": vertical_evidence,
    }


def inspect_archive(path: Path, root: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": path.relative_to(root).as_posix(),
        "size_bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "zip_integrity": "FAIL",
        "unsafe_members": [],
        "duplicate_members": [],
        "member_count": 0,
        "project_files": [],
        "geometry_files": [],
        "flow_plan_files": [],
        "output_files": [],
        "crs_evidence": [],
        "epsg_codes": [],
        "vertical_datum_evidence": [],
        "spatial_compatibility": "NOT_VERIFIED",
        "engineering_approval": "NOT_GRANTED",
        "errors": [],
        "warnings": [],
    }
    try:
        with zipfile.ZipFile(path, "r") as archive:
            infos = archive.infolist()
            names = [item.filename for item in infos]
            result["member_count"] = len(infos)
            result["unsafe_members"] = sorted({name for name in names if not safe_member_name(name)})
            result["duplicate_members"] = sorted({name for name in names if names.count(name) > 1})
            oversized = [
                item.filename for item in infos
                if item.file_size > MAX_MEMBER_BYTES
                or (item.file_size > 1_000_000 and item.compress_size > 0
                    and item.file_size / item.compress_size > 1000)
            ]
            if result["unsafe_members"]:
                result["errors"].append("Archive contains unsafe absolute/traversal member paths.")
            if result["duplicate_members"]:
                result["errors"].append("Archive contains duplicate member names.")
            if oversized:
                result["errors"].append("Archive contains oversized or suspiciously compressed members.")
            if not names:
                result["errors"].append("Archive is empty.")
            bad_member = archive.testzip()
            if bad_member is not None:
                result["errors"].append(f"CRC failure in member: {bad_member}")
            result["zip_integrity"] = "PASS" if not result["errors"] else "FAIL"

            lower_names = [name.lower() for name in names if not name.endswith("/")]
            result["project_files"] = [n for n in lower_names if PurePosixPath(n).suffix == ".prj"]
            result["geometry_files"] = [
                n for n in lower_names if re.search(r"\.g\d{2}$", n, re.IGNORECASE)
            ]
            result["flow_plan_files"] = [
                n for n in lower_names if re.search(r"\.[fpu]\d{2}$", n, re.IGNORECASE)
            ]
            result["output_files"] = [
                n for n in lower_names if re.search(r"\.o\d{2}$", n, re.IGNORECASE)
                or n.endswith(".hdf")
            ]
            evidence = extract_text_evidence(archive, names)
            result.update(evidence)
            if not result["project_files"]:
                result["warnings"].append("No HEC-RAS .prj project file detected.")
            if not result["geometry_files"]:
                result["warnings"].append("No HEC-RAS geometry (.g##) file detected.")
            if not result["epsg_codes"] and not result["crs_evidence"]:
                result["warnings"].append("No explicit horizontal CRS evidence found in scanned text members.")
            if not result["vertical_datum_evidence"]:
                result["warnings"].append("No explicit vertical datum evidence found in scanned text members.")
            result["structure_review"] = (
                "PROJECT_AND_GEOMETRY_PRESENT"
                if result["project_files"] and result["geometry_files"]
                else "INCOMPLETE_OR_LEGACY_STRUCTURE_REQUIRES_REVIEW"
            )
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        result["errors"].append(f"Cannot read ZIP archive: {type(exc).__name__}: {exc}")
        result["zip_integrity"] = "FAIL"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd(), help="Repository root")
    parser.add_argument(
        "--archive-root", type=Path, default=ARCHIVE_ROOT,
        help="Archive directory relative to repository root",
    )
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    args = parser.parse_args()
    root = args.root.resolve()
    archive_root = (root / args.archive_root).resolve()
    if not archive_root.is_relative_to(root) or not archive_root.is_dir():
        print(f"ERROR: archive root missing or outside repository: {archive_root}", file=sys.stderr)
        return 2

    archives = sorted(archive_root.rglob("*.zip"))
    if not archives:
        print(f"ERROR: no model ZIP archives found under {archive_root}", file=sys.stderr)
        return 2

    records = [inspect_archive(path, root) for path in archives]
    report = {
        "schema_version": "1.0.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repository_relative_archive_root": archive_root.relative_to(root).as_posix(),
        "archive_count": len(records),
        "valid_zip_count": sum(record["zip_integrity"] == "PASS" for record in records),
        "failed_zip_count": sum(record["zip_integrity"] != "PASS" for record in records),
        "gate": "PASS" if all(record["zip_integrity"] == "PASS" for record in records) else "FAIL",
        "scope_note": (
            "ZIP integrity, full SHA-256, structure hints, and textual CRS/datum discovery only. "
            "This does not establish spatial overlap, model currency, boundary-condition validity, "
            "solver compatibility, or engineering approval."
        ),
        "archives": records,
    }
    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        output = args.output if args.output.is_absolute() else root / args.output
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(encoded, encoding="utf-8")
    print(json.dumps({
        "gate": report["gate"],
        "archive_count": report["archive_count"],
        "valid_zip_count": report["valid_zip_count"],
        "failed_zip_count": report["failed_zip_count"],
        "full_sha256_emitted": True,
        "output": str(args.output) if args.output else None,
        "spatial_compatibility": "NOT_VERIFIED",
        "engineering_approval": "NOT_GRANTED",
    }, sort_keys=True))
    return 0 if report["gate"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
