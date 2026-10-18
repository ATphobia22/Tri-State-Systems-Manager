#!/usr/bin/env python3
"""Validate committed hydraulic-model ZIP archives without launching a solver.

This is an archive-integrity and metadata-discovery gate, not a HEC-RAS solver
validation, spatial-overlap determination, or engineering approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

ARCHIVE_ROOT = Path("data/fabrics/hydraulic-models")
TEXT_SUFFIXES = {".prj", ".txt", ".dat", ".xml", ".csv", ".rasmap", ".ini"}
HECRAS_SUFFIX = re.compile(r"^\.(?:g|f|p|u|r|o)\d{2}$", re.IGNORECASE)
GEOMETRY_SUFFIX = re.compile(r"^\.g\d{2}$", re.IGNORECASE)
XS_CUT_LINE_RE = re.compile(r"^\s*XS GIS Cut Line\s*=\s*(\d+)\s*$", re.IGNORECASE)
GIS_CLAIM_PATTERNS = {
    "gis_map_projection": re.compile(r"^\s*GIS Map Projection\s*=\s*(.*?)\s*$", re.IGNORECASE),
    "gis_projection_zone": re.compile(r"^\s*GIS Projection Zone\s*=\s*(.*?)\s*$", re.IGNORECASE),
    "gis_datum": re.compile(r"^\s*GIS Datum\s*=\s*(.*?)\s*$", re.IGNORECASE),
    "gis_vertical_datum": re.compile(r"^\s*GIS Vertical Datum\s*=\s*(.*?)\s*$", re.IGNORECASE),
    "model_vertical_datum": re.compile(r"^\s*Model Vertical Datum\s+is\s+(.*?)\s*$", re.IGNORECASE),
}
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
MAX_GEOMETRY_SCAN_BYTES = 32 * 1024 * 1024
MAX_MEMBER_BYTES = 1024 * 1024 * 1024
MAX_GIS_CUT_LINE_POINTS = 100_000


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




def _read_small_text_member(archive: zipfile.ZipFile, name: str, max_bytes: int) -> str | None:
    """Read a bounded UTF-8 text member without extracting it to disk."""
    try:
        info = archive.getinfo(name)
        if info.file_size > max_bytes:
            return None
        return archive.read(name).decode("utf-8", errors="ignore")
    except (KeyError, OSError, RuntimeError, zipfile.BadZipFile):
        return None


def extract_spatial_reference_claims(archive: zipfile.ZipFile, names: list[str]) -> dict[str, Any]:
    """Capture literal CRS/datum fields; a claim is not verification."""
    claims: list[dict[str, str]] = []
    for name in names:
        suffix = PurePosixPath(name).suffix.lower()
        if suffix not in TEXT_SUFFIXES and not HECRAS_SUFFIX.match(suffix):
            continue
        text = _read_small_text_member(archive, name, MAX_TEXT_SCAN_BYTES)
        if text is None:
            continue
        matched: dict[str, str] = {}
        for line in text.splitlines():
            for key, pattern in GIS_CLAIM_PATTERNS.items():
                match = pattern.match(line)
                if match:
                    matched[key] = match.group(1).strip()
        if not matched:
            continue
        record: dict[str, str] = {"member": name, **matched}
        projection = record.get("gis_map_projection", "").strip().upper()
        zone = record.get("gis_projection_zone", "").strip()
        datum = record.get("gis_datum", "").strip().upper()
        if projection == "STATEPLANE" and zone == "2966" and datum in {"NAD83", "NAD 83"}:
            record["candidate_crs"] = "EPSG:2966"
            record["candidate_crs_status"] = "INFERRED_FROM_LITERAL_GIS_FIELDS_NOT_INDEPENDENTLY_VERIFIED"
        claims.append(record)
    return {
        "spatial_reference_claims": claims,
        "spatial_reference_claim_status": "LITERAL_METADATA_FOUND" if claims else "NO_LITERAL_METADATA_FOUND",
        "candidate_crs_codes": sorted({item["candidate_crs"] for item in claims if item.get("candidate_crs")}),
    }


def _parse_numeric_coordinate_line(line: str) -> list[float]:
    """Parse fixed-width HEC-RAS XY values or whitespace/comma-delimited numeric tokens."""
    raw = line.rstrip("\r\n")
    if not raw.strip():
        return []
    if len(raw) >= 32 and len(raw) % 16 == 0:
        fields = [raw[i:i + 16].strip() for i in range(0, len(raw), 16)]
        try:
            values = [float(field) for field in fields if field]
            if len(values) >= 2:
                return values
        except ValueError:
            pass
    tokens = [token for token in re.split(r"[\s,;]+", raw.strip()) if token]
    if len(tokens) < 2:
        return []
    try:
        return [float(token) for token in tokens]
    except ValueError:
        return []


def inspect_gis_cut_lines(text: str, member_name: str) -> dict[str, Any]:
    """Extract native XY values from HEC-RAS XS GIS Cut Line records only.

    Coordinates are intentionally not reprojected or used to claim AOI overlap.
    CRS, units, model-domain coverage, and suitability require separate review.
    """
    lines = text.splitlines()
    blocks: list[dict[str, Any]] = []
    all_x: list[float] = []
    all_y: list[float] = []
    errors: list[str] = []
    i = 0
    while i < len(lines):
        match = XS_CUT_LINE_RE.match(lines[i])
        if not match:
            i += 1
            continue
        point_count = int(match.group(1))
        if point_count < 2 or point_count > MAX_GIS_CUT_LINE_POINTS:
            errors.append(f"{member_name}:{i + 1}: cut-line point count outside accepted bounds: {point_count}")
            blocks.append({"line": i + 1, "declared_point_count": point_count, "parsed_point_count": 0, "status": "INVALID_POINT_COUNT"})
            i += 1
            continue

        required_values = point_count * 2
        values: list[float] = []
        j = i + 1
        while j < len(lines) and len(values) < required_values:
            candidate = lines[j]
            stripped = candidate.strip()
            if not stripped:
                j += 1
                continue
            if re.match(r"^[A-Za-z#][A-Za-z0-9 _/#().-]*=", stripped):
                break
            parsed = _parse_numeric_coordinate_line(candidate)
            if not parsed:
                break
            values.extend(parsed[:required_values - len(values)])
            j += 1

        if len(values) == required_values and all(math.isfinite(value) for value in values):
            pairs = [(values[k], values[k + 1]) for k in range(0, required_values, 2)]
            xs = [pair[0] for pair in pairs]
            ys = [pair[1] for pair in pairs]
            all_x.extend(xs)
            all_y.extend(ys)
            blocks.append({
                "line": i + 1,
                "declared_point_count": point_count,
                "parsed_point_count": len(pairs),
                "raw_xy_bounds": {"min_x": min(xs), "min_y": min(ys), "max_x": max(xs), "max_y": max(ys)},
                "status": "PARSED",
            })
        else:
            errors.append(f"{member_name}:{i + 1}: expected {point_count} XY pairs, parsed {len(values) // 2}")
            blocks.append({
                "line": i + 1,
                "declared_point_count": point_count,
                "parsed_point_count": len(values) // 2,
                "status": "INCOMPLETE_COORDINATES",
            })
        i = max(i + 1, j)

    bounds = None
    if all_x and all_y:
        bounds = {"min_x": min(all_x), "min_y": min(all_y), "max_x": max(all_x), "max_y": max(all_y)}
    return {
        "member": member_name,
        "cross_section_cut_line_count": len(blocks),
        "complete_cut_line_count": sum(block["status"] == "PARSED" for block in blocks),
        "coordinate_pair_count": sum(block.get("parsed_point_count", 0) for block in blocks),
        "raw_xy_bounds": bounds,
        "blocks": blocks,
        "errors": errors,
        "coordinate_space": "NATIVE_MODEL_COORDINATES_NOT_REPROJECTED",
        "status": "PARSED" if blocks and not errors else "PARTIAL_PARSE" if blocks else "NO_XS_GIS_CUT_LINES_FOUND",
    }


def extract_geometry_coordinate_summary(archive: zipfile.ZipFile, names: list[str]) -> dict[str, Any]:
    geometry_names = [name for name in names if GEOMETRY_SUFFIX.match(PurePosixPath(name).suffix)]
    per_file: list[dict[str, Any]] = []
    skipped_size_limit: list[str] = []
    for name in geometry_names:
        try:
            info = archive.getinfo(name)
        except KeyError:
            continue
        if info.file_size > MAX_GEOMETRY_SCAN_BYTES:
            skipped_size_limit.append(name)
            continue
        text = _read_small_text_member(archive, name, MAX_GEOMETRY_SCAN_BYTES)
        if text is None:
            continue
        parsed = inspect_gis_cut_lines(text, name)
        if parsed["cross_section_cut_line_count"] or parsed["errors"]:
            per_file.append(parsed)

    usable = [item for item in per_file if item["raw_xy_bounds"] is not None]
    bounds = None
    if usable:
        bounds = {
            "min_x": min(item["raw_xy_bounds"]["min_x"] for item in usable),
            "min_y": min(item["raw_xy_bounds"]["min_y"] for item in usable),
            "max_x": max(item["raw_xy_bounds"]["max_x"] for item in usable),
            "max_y": max(item["raw_xy_bounds"]["max_y"] for item in usable),
        }
    line_count = sum(item["cross_section_cut_line_count"] for item in per_file)
    complete_count = sum(item["complete_cut_line_count"] for item in per_file)
    errors = [error for item in per_file for error in item["errors"]]
    if bounds is None:
        status = "SCAN_SIZE_LIMIT" if skipped_size_limit and not per_file else "NO_XS_GIS_CUT_LINES_FOUND"
    elif errors or complete_count < line_count:
        status = "PARTIAL_PARSE"
    else:
        status = "PARSED"
    return {
        "geometry_files_present": geometry_names,
        "geometry_files_scanned": [item["member"] for item in per_file],
        "geometry_files_skipped_size_limit": skipped_size_limit,
        "cross_section_cut_line_count": line_count,
        "complete_cut_line_count": complete_count,
        "coordinate_pair_count": sum(item["coordinate_pair_count"] for item in per_file),
        "native_xy_bounds": bounds,
        "coordinate_space": "NATIVE_MODEL_COORDINATES_NOT_REPROJECTED",
        "spatial_overlap": "NOT_COMPUTED",
        "spatial_compatibility": "NOT_VERIFIED",
        "status": status,
        "per_file": per_file,
        "errors": errors,
        "note": (
            "Bounds use parsed XS GIS Cut Line points only and remain in native model coordinates. "
            "CRS, coordinate units, true model-domain coverage, and overlap with parcel/structure/catchment are not established."
        ),
    }



def _resolve_plan_reference(plan_name: str, reference: str, names: list[str], reference_kind: str) -> dict[str, Any]:
    """Resolve a HEC-RAS plan's short file reference against archive members."""
    normalized = reference.strip().replace("\\", "/")
    if not normalized:
        return {"kind": reference_kind, "reference": reference, "status": "NOT_SPECIFIED", "candidates": []}
    basename = PurePosixPath(normalized).name
    normalized_lower = normalized.casefold()
    members = [name for name in names if not name.endswith("/")]

    candidates = [name for name in members if name.replace("\\", "/").casefold() == normalized_lower]
    if not candidates:
        candidates = [name for name in members if PurePosixPath(name.replace("\\", "/")).name.casefold() == basename.casefold()]

    # HEC-RAS plan files commonly use short references like g01/f01/u01.
    if not candidates:
        short = re.search(r"([gfuqb]\d{2})$", basename, re.IGNORECASE)
        if short:
            suffix = "." + short.group(1).lower()
            candidates = [name for name in members if PurePosixPath(name).suffix.lower() == suffix]

    allowed_suffix = (
        re.compile(r"^\.g\d{2}$", re.IGNORECASE)
        if reference_kind == "geometry"
        else re.compile(r"^\.[fuqb]\d{2}$", re.IGNORECASE)
    )
    candidates = [name for name in candidates if allowed_suffix.match(PurePosixPath(name).suffix)]

    if len(candidates) > 1:
        plan_parent = PurePosixPath(plan_name).parent
        siblings = [name for name in candidates if PurePosixPath(name).parent == plan_parent]
        if len(siblings) == 1:
            candidates = siblings

    if len(candidates) == 1:
        return {
            "kind": reference_kind,
            "reference": reference,
            "status": "RESOLVED",
            "resolved_member": candidates[0],
            "candidates": candidates,
        }
    if not candidates:
        recognizable = bool(PurePosixPath(basename).suffix) or bool(
            re.search(r"[gfuqb]\d{2}$", basename, re.IGNORECASE)
        )
        return {
            "kind": reference_kind,
            "reference": reference,
            "status": "MISSING" if recognizable else "UNRECOGNIZED_REFERENCE",
            "candidates": [],
        }
    return {
        "kind": reference_kind,
        "reference": reference,
        "status": "AMBIGUOUS",
        "candidates": sorted(candidates),
    }


def extract_plan_reference_closure(archive: zipfile.ZipFile, names: list[str]) -> dict[str, Any]:
    """Check geometry/flow references declared by ASCII HEC-RAS plan files."""
    plan_files = [
        name for name in names
        if re.search(r"\.p\d{2}$", name, re.IGNORECASE) and not name.endswith("/")
    ]
    plans: list[dict[str, Any]] = []
    for plan_name in plan_files:
        text = _read_small_text_member(archive, plan_name, MAX_TEXT_SCAN_BYTES)
        if text is None:
            plans.append({
                "member": plan_name,
                "status": "UNREADABLE_OR_SIZE_LIMIT",
                "references": [],
                "errors": ["Plan file could not be read within the bounded scan limit."],
            })
            continue
        references_by_kind: dict[str, str] = {}
        for line in text.splitlines():
            geom_match = re.match(r"^\s*Geom File\s*=\s*(.*?)\s*$", line, re.IGNORECASE)
            flow_match = re.match(r"^\s*Flow File\s*=\s*(.*?)\s*$", line, re.IGNORECASE)
            if geom_match:
                references_by_kind["geometry"] = geom_match.group(1).strip()
            if flow_match:
                references_by_kind["flow"] = flow_match.group(1).strip()

        references = [
            _resolve_plan_reference(plan_name, value, names, kind)
            for kind, value in references_by_kind.items()
        ]
        missing_fields = sorted({"geometry", "flow"} - set(references_by_kind))
        statuses = [reference["status"] for reference in references]
        if any(status in {"MISSING", "AMBIGUOUS", "UNRECOGNIZED_REFERENCE"} for status in statuses):
            plan_status = "UNRESOLVED_REFERENCE"
        elif missing_fields or any(status == "NOT_SPECIFIED" for status in statuses):
            plan_status = "INCOMPLETE_REFERENCE_METADATA"
        elif statuses and all(status == "RESOLVED" for status in statuses):
            plan_status = "CLOSED"
        else:
            plan_status = "INCOMPLETE_REFERENCE_METADATA"
        plans.append({
            "member": plan_name,
            "status": plan_status,
            "references": references,
            "missing_reference_fields": missing_fields,
        })

    if not plan_files:
        overall_status = "NOT_CHECKED_NO_PLAN_FILES"
    elif any(plan["status"] == "UNRESOLVED_REFERENCE" for plan in plans):
        overall_status = "UNRESOLVED_REFERENCE"
    elif any(plan["status"] != "CLOSED" for plan in plans):
        overall_status = "INCOMPLETE_REFERENCE_METADATA"
    else:
        overall_status = "CLOSED"
    return {
        "status": overall_status,
        "plan_count": len(plan_files),
        "checked_plan_count": len(plans),
        "plans": plans,
        "scope_note": (
            "Checks explicit Geom File and Flow File links in ASCII plan files. "
            "It does not establish solver compatibility, plan currency, or hydraulic validity."
        ),
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
        "plan_files": [],
        "flow_files": [],
        "flow_plan_files": [],
        "project_reference_closure": {"status": "NOT_CHECKED_NO_PLAN_FILES", "plan_count": 0, "checked_plan_count": 0, "plans": []},
        "output_files": [],
        "crs_evidence": [],
        "epsg_codes": [],
        "vertical_datum_evidence": [],
        "spatial_reference_claims": [],
        "spatial_reference_claim_status": "NO_LITERAL_METADATA_FOUND",
        "candidate_crs_codes": [],
        "gis_geometry": {},
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
            result["plan_files"] = [n for n in lower_names if re.search(r"\.p\d{2}$", n, re.IGNORECASE)]
            result["flow_files"] = [n for n in lower_names if re.search(r"\.[fuqb]\d{2}$", n, re.IGNORECASE)]
            result["output_files"] = [
                n for n in lower_names if re.search(r"\.o\d{2}$", n, re.IGNORECASE)
                or n.endswith(".hdf")
            ]
            evidence = extract_text_evidence(archive, names)
            result.update(evidence)
            result.update(extract_spatial_reference_claims(archive, names))
            result["gis_geometry"] = extract_geometry_coordinate_summary(archive, names)
            result["project_reference_closure"] = extract_plan_reference_closure(archive, names)
            if result["project_reference_closure"]["status"] != "CLOSED":
                result["warnings"].append(
                    "Plan-to-geometry/flow reference closure is incomplete, unresolved, or not checkable."
                )
            if not result["project_files"]:
                result["warnings"].append("No HEC-RAS .prj project file detected.")
            if not result["geometry_files"]:
                result["warnings"].append("No HEC-RAS geometry (.g##) file detected.")
            if not result["epsg_codes"] and not result["crs_evidence"]:
                result["warnings"].append("No explicit horizontal CRS evidence found in scanned text members.")
            if not result["vertical_datum_evidence"]:
                result["warnings"].append("No explicit vertical datum evidence found in scanned text members.")
            if result["gis_geometry"]["status"] != "PARSED":
                result["warnings"].append(
                    "GIS cross-section coordinate extraction is absent, incomplete, or size-limited; spatial overlap remains unverified."
                )
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
        "schema_version": "1.2.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "repository_relative_archive_root": archive_root.relative_to(root).as_posix(),
        "archive_count": len(records),
        "valid_zip_count": sum(record["zip_integrity"] == "PASS" for record in records),
        "failed_zip_count": sum(record["zip_integrity"] != "PASS" for record in records),
        "gate": "PASS" if all(record["zip_integrity"] == "PASS" for record in records) else "FAIL",
        "scope_note": (
            "ZIP integrity, full SHA-256, structure hints, bounded CRS/datum discovery, native HEC-RAS XS GIS cut-line coordinate extraction, and plan-to-file closure. "
            "Coordinates are not reprojected; this does not establish exact CRS/units, model-domain coverage, spatial overlap, model currency, "
            "boundary-condition validity, solver compatibility, or engineering approval."
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
        "native_xy_bounds_extracted": sum(record["gis_geometry"]["native_xy_bounds"] is not None for record in records),
        "spatial_overlap": "NOT_COMPUTED",
        "full_sha256_emitted": True,
        "output": str(args.output) if args.output else None,
        "spatial_compatibility": "NOT_VERIFIED",
        "engineering_approval": "NOT_GRANTED",
    }, sort_keys=True))
    return 0 if report["gate"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
