"""Offline USACE/USGS hydrographic source preflight; never fabricate riverbed elevations.

No network, no GIS reprojection and no automatic vertical conversion. A bathymetry
inventory or eHydro extent polygon is NOT an elevation survey.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path

from .contracts import canonical

SCHEMA = "tsm.bathymetric-survey-intake.v1"
OFFICIAL_HOSTS = ("usace.army.mil", "usgs.gov", "sciencebase.gov")
MAX_SURVEY_BYTES = 32 * 1024 * 1024 * 1024
MAX_JSON_BYTES = 1024 * 1024
REQUIRED = ("source_uri", "survey_id", "authority", "acquired_at", "published_at",
            "retrieved_at", "horizontal_crs", "horizontal_units", "vertical_datum",
            "vertical_units", "z_semantics", "survey_bbox_wgs84",
            "survey_method", "source_sha256", "source_file", "uncertainty_95_vertical_ft")
HORIZONTAL_UNITS = {"m", "ftUS", "degree"}
VERTICAL_UNITS = {"m", "ft", "ftUS"}
Z_SEMANTICS = {"BOTTOM_ELEVATION", "POSITIVE_DEPTH_BELOW_REFERENCE", "NEGATIVE_DEPTH_BELOW_REFERENCE"}
VERTICAL_DATUMS = {"NAVD88", "NGVD29", "OHIO_RIVER_DATUM", "OTHER_DOCUMENTED"}
SURVEY_METHODS = {"SINGLEBEAM_SONAR", "MULTIBEAM_SONAR", "TOPOBATHY_LIDAR", "OTHER_DOCUMENTED"}


def _when(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("MISSING_UTC_TIMESTAMP")
    try:
        date = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if date.utcoffset() is None:
            raise ValueError
        return date.astimezone(timezone.utc)
    except ValueError as error:
        raise ValueError("INVALID_UTC_TIMESTAMP") from error


def _bbox(value: object) -> tuple[float, float, float, float]:
    if (not isinstance(value, list) or len(value) != 4
            or any(type(v) not in (float, int) or not math.isfinite(v) for v in value)):
        raise ValueError("INVALID_WGS84_BBOX")
    west, south, east, north = value
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("INVALID_WGS84_BBOX")
    return west, south, east, north


def _overlap(a, b) -> bool:
    return min(a[2], b[2]) > max(a[0], b[0]) and min(a[3], b[3]) > max(a[1], b[1])


def _source(path: Path, root: Path, expected: str) -> tuple[str | None, str | None]:
    if (not isinstance(expected, str) or len(expected) != 64 or
            any(c not in "0123456789abcdef" for c in expected)):
        return None, "INVALID_SOURCE_HASH"
    if (path.is_absolute() or not path.parts or "\\" in str(path) or
            ":" in str(path) or any(p in (".", "..") for p in path.parts)):
        return None, "UNSAFE_SOURCE_PATH"
    current = root
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            return None, "SYMLINK_SOURCE_REJECTED"
    if not current.resolve().is_relative_to(root.resolve()):
        return None, "SOURCE_OUTSIDE_ROOT"
    try:
        if not current.is_file() or current.stat().st_size <= 0 or current.stat().st_size > MAX_SURVEY_BYTES:
            return None, "SOURCE_MISSING_OR_OVERSIZED"
        dig = hashlib.sha256()
        with current.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                dig.update(block)
        actual = dig.hexdigest()
    except OSError:
        return None, "SOURCE_UNREADABLE"
    return (actual, None) if actual == expected else (None, "SOURCE_SHA256_MISMATCH")


def inspect(manifest: dict, root: Path, aoi_bbox: list[float]) -> dict:
    if not isinstance(manifest, dict) or manifest.get("schema") != SCHEMA:
        raise ValueError("Unsupported survey manifest schema")
    if any(k not in manifest for k in REQUIRED):
        raise ValueError("Incomplete required survey provenance")
    aoi = _bbox(aoi_bbox)
    survey = _bbox(manifest["survey_bbox_wgs84"])
    blockers = []
    authority = manifest["authority"]
    uri = manifest["source_uri"]
    from urllib.parse import urlsplit
    try:
        u = urlsplit(uri)
        domain = (u.hostname or "").lower()
    except (ValueError, TypeError):
        domain = ""
        u = None
    if (authority not in ("USACE", "USGS") or u is None or u.scheme != "https"
            or not any(domain == d or domain.endswith("." + d) for d in OFFICIAL_HOSTS)):
        blockers.append("SOURCE_AUTHORITY_NOT_PRIMARY_VERIFIED")
    if not isinstance(manifest["survey_id"], str) or not manifest["survey_id"].strip():
        blockers.append("SURVEY_ID_MISSING")
    try:
        acquired, published, retrieved = (_when(manifest[k])
            for k in ("acquired_at", "published_at", "retrieved_at"))
        if not acquired <= published <= retrieved:
            blockers.append("SURVEY_DATE_ORDER_INVALID")
    except ValueError:
        blockers.append("SURVEY_DATES_INVALID")
    if not _overlap(aoi, survey):
        blockers.append("SURVEY_DOES_NOT_INTERSECT_AOI")
    if (manifest["horizontal_crs"] not in ("EPSG:2966", "EPSG:26916", "EPSG:3089", "EPSG:4326")
            or manifest["horizontal_units"] not in HORIZONTAL_UNITS):
        blockers.append("UNREVIEWED_HORIZONTAL_CRS_UNITS")
    # A source can declare a known EPSG code with the wrong axis units.
    expected_horizontal_units = {
        "EPSG:2966": "ftUS", "EPSG:26916": "m",
        "EPSG:3089": "m", "EPSG:4326": "degree"
    }
    if expected_horizontal_units.get(manifest["horizontal_crs"]) != manifest["horizontal_units"]:
        blockers.append("HORIZONTAL_CRS_UNIT_CONTRADICTION")
    if (manifest["vertical_datum"] not in VERTICAL_DATUMS or
            manifest["vertical_units"] not in VERTICAL_UNITS or
            manifest["z_semantics"] not in Z_SEMANTICS or
            manifest["survey_method"] not in SURVEY_METHODS):
        blockers.append("UNKNOWN_SURVEY_OR_VERTICAL_UNITS")
    uncertainty = manifest["uncertainty_95_vertical_ft"]
    if type(uncertainty) not in (float, int) or not math.isfinite(uncertainty) or uncertainty <= 0:
        blockers.append("VERTICAL_UNCERTAINTY_NOT_EVIDENCED")
    path = manifest["source_file"]
    if not isinstance(path, str):
        blockers.append("SOURCE_FILE_INVALID")
        actual, issue = None, "UNSAFE_SOURCE_PATH"
    else:
        actual, issue = _source(Path(path), root, manifest["source_sha256"])
    if issue:
        blockers.append(issue)
    vertical_transform = manifest.get("navd88_transform")
    if manifest["vertical_datum"] != "NAVD88":
        # Merely naming an offset/grid is insufficient for a trusted conversion;
        # the reviewed tie must carry source identity and independent control.
        if (not isinstance(vertical_transform, dict) or
                vertical_transform.get("reviewed") is not True or
                not isinstance(vertical_transform.get("evidence_uri"), str) or
                not vertical_transform["evidence_uri"].startswith("https://") or
                not isinstance(vertical_transform.get("source_sha256"), str) or
                len(vertical_transform["source_sha256"]) != 64):
            blockers.append("NAVD88_TRANSFORMATION_NOT_REVIEWED")
        # No coordinates are transformed by this metadata checker.
    if manifest["z_semantics"] != "BOTTOM_ELEVATION":
        blockers.append("DEPTH_TO_ELEVATION_CONVERSION_NOT_ESTABLISHED")
    if manifest.get("grid_quality_reviewed") is not True:
        blockers.append("BED_COVERAGE_AND_INTERPOLATION_QA_PENDING")
    if manifest.get("independent_control_reviewed") is not True:
        blockers.append("INDEPENDENT_SURVEY_CONTROL_PENDING")
    result = {
        "schema": SCHEMA,
        "status": ("REVIEWABLE_SOURCE_METADATA" if not blockers else "WITHHELD_SOURCE_EVIDENCE"),
        "engineeringCertification": False,
        "regulatoryDetermination": False,
        "sourceSurveyId": manifest.get("survey_id"),
        "surveySha256": actual,
        "surveyBboxWgs84": survey,
        "aoiBboxWgs84": aoi,
        "verticalDatum": manifest["vertical_datum"],
        "zSemantics": manifest["z_semantics"],
        "analysis": "NO_RIVERBED_RASTER_GENERATED",
        "blockers": sorted(set(blockers)),
    }
    result["receiptSha256"] = hashlib.sha256(canonical(result).encode()).hexdigest()
    return result


def main() -> None:
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("survey_manifest", type=Path)
    cli.add_argument("--survey-root", required=True, type=Path)
    cli.add_argument("--aoi-bbox", nargs=4, type=float, required=True,
                     metavar=("WEST", "SOUTH", "EAST", "NORTH"))
    args = cli.parse_args()
    if (not args.survey_manifest.is_file() or args.survey_manifest.is_symlink()
            or args.survey_manifest.stat().st_size > MAX_JSON_BYTES):
        raise ValueError("Survey manifest file invalid")
    report = inspect(json.loads(args.survey_manifest.read_text(encoding="utf8")),
                     args.survey_root, args.aoi_bbox)
    print(canonical(report))
    if report["status"] != "REVIEWABLE_SOURCE_METADATA":
        raise SystemExit(2)


if __name__ == "__main__":
    main()
