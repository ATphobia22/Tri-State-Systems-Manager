#!/usr/bin/env python3
"""Strict source-level waypoint geodetic gate for TSM.

Geographic input fields are latitude/longitude degrees, never EPSG:2966 feet.
PROJ projects for *informational contextualization*, not a survey datum
transformation. Vertical heights from NGVD29/ellipsoidal frames are quarantined
until an independently documented, grid-backed transformation to NAVD88 exists.
Neither a geoid constant nor silent epoch assumption is permitted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker
from pyproj import CRS, Transformer

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / "schemas" / "compass-waypoint.schema.json"
SCHEMA_VERSION = "tsm.compass-waypoint-geodetic-gate.v1"
CONTEXT_ONLY = "ACCEPTED_FOR_CONTEXT_ONLY"
REJECTED = "REJECTED"
QUARANTINED = "DATUM_TRANSFORMATION_REQUIRED"


class WaypointGeodeticError(ValueError):
    def __init__(self, message: str, state: str = REJECTED):
        super().__init__(message)
        self.state = state


def _reject_nonfinite(text: str):
    raise WaypointGeodeticError("NaN and Infinity are prohibited in geodetic JSON")


def validate_payload(payload: object) -> dict:
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(payload),
        key=lambda item: list(str(part) for part in item.absolute_path),
    )
    if errors:
        issue = errors[0]
        # No coordinate values are exposed in diagnostic text/logs.
        path = "/".join(str(part) for part in issue.absolute_path)
        raise WaypointGeodeticError(f"waypoint schema mismatch at {path}: {issue.validator}")

    assert isinstance(payload, dict)
    crs_name = payload["coordinateReferenceSystem"]
    crs = CRS.from_user_input(crs_name)
    if not crs.is_geographic or crs.to_epsg() not in (4326,) and crs_name != "OGC:CRS84":
        raise WaypointGeodeticError("latitude/longitude must use a geographic CRS, not projected EPSG:2966")

    coords = payload["coordinates"]
    lat, lon = float(coords["latitude"]), float(coords["longitude"])
    if not (math.isfinite(lat) and math.isfinite(lon)):
        raise WaypointGeodeticError("nonfinite latitude/longitude")
    if abs(lat) > 90 or abs(lon) > 180:
        raise WaypointGeodeticError("invalid geographic coordinate range")

    # This is only a spatial sanity/projection check. EPSG:4326 WGS84 and
    # EPSG:2966 NAD83 are not a centimeter-accuracy NAD83(2011) epoch tie.
    projected = Transformer.from_crs(crs, CRS.from_epsg(2966), always_xy=True)
    east, north = projected.transform(lon, lat, errcheck=True)
    if not (math.isfinite(east) and math.isfinite(north)):
        raise WaypointGeodeticError("PROJ transform produced nonfinite projected coordinates")

    if isinstance(coords.get("elevation"), (float, int)) and not isinstance(coords.get("elevation"), bool):
        if coords.get("verticalDatum") != "NAVD88":
            raise WaypointGeodeticError(
                "source height cannot be ingested as NAVD88: independent transform grids, realization, epoch and uncertainty required",
                QUARANTINED,
            )
        if coords.get("elevationUnit") not in ("m", "ft", "ftUS"):
            raise WaypointGeodeticError("elevation has no recognized unit")
        # Conversion of units alone does NOT change vertical datum.
        factor = {"m": 1.0, "ft": 0.3048, "ftUS": 1200.0 / 3937.0}[coords["elevationUnit"]]
        if not math.isfinite(float(coords["elevation"]) * factor):
            raise WaypointGeodeticError("nonfinite elevation in metres")

    # Do not write precise user waypoints or projected coordinates to reports.
    return {
        "schemaVersion": SCHEMA_VERSION,
        "state": CONTEXT_ONLY,
        "sourceCrs": crs_name,
        "projectedContextCrs": "EPSG:2966",
        "projectedContextHorizontalUnit": "ftUS",
        "verticalDatum": coords.get("verticalDatum"),
        "engineeringUse": "NOT_AUTHORIZED",
        "regulatoryDetermination": None,
        "surveyGradeCertified": False,
        "transformAccuracyCertified": False,
        "coordinatesEmitted": False,
        "note": "PROJ coordinate projection verified; positional accuracy and datum transformation NOT certified",
    }


def validate_bytes(data: bytes) -> dict:
    sha = hashlib.sha256(data).hexdigest()
    try:
        payload = json.loads(data, parse_constant=_reject_nonfinite)
        report = validate_payload(payload)
    except (WaypointGeodeticError, ValueError, TypeError) as exc:
        report = {
            "schemaVersion": SCHEMA_VERSION,
            "state": exc.state if isinstance(exc, WaypointGeodeticError) else REJECTED,
            "errorCode": str(exc) if isinstance(exc, WaypointGeodeticError) else type(exc).__name__,
            "engineeringUse": "NOT_AUTHORIZED",
            "regulatoryDetermination": None,
            "surveyGradeCertified": False,
            "coordinatesEmitted": False,
        }
    report["sourcePayloadSha256"] = sha
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    if args.input.resolve() == args.report.resolve() or args.report.exists():
        parser.error("report path must not alias source or overwrite existing evidence")
    report = validate_bytes(args.input.read_bytes())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"state": report["state"], "sourcePayloadSha256": report["sourcePayloadSha256"]}))
    return 0 if report["state"] == CONTEXT_ONLY else 2


if __name__ == "__main__":
    raise SystemExit(main())
