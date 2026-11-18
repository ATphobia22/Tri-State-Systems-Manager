#!/usr/bin/env python3
"""GeoTruth Inspector: offline, non-certifying QA of published building features.

Reads only local files. Existing Posey archived IGIO delta is an *archived
project* source-ID claim, not proof of present official agency/source accuracy.
No building height, vertical datum or roof model is treated as surveyed.
"""
from __future__ import annotations

import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import sys

try:
    from scripts.geospatial.reconcile_published_buildings import _identifier, _inventory
except ModuleNotFoundError:
    # CLI execution via python scripts/geospatial/geotruth_inspector.py
    from reconcile_published_buildings import _identifier, _inventory

MAX_GEOJSON_BYTES = 256 * 1024 * 1024
SCHEMA = "tsm.geotruth.building-qa.v1"


def _read_bounded_bytes(path: Path) -> bytes:
    if path.is_symlink() or not path.is_file() or path.stat().st_size > MAX_GEOJSON_BYTES:
        raise ValueError("Input must be a bounded regular JSON file, not a symlink")
    with path.open("rb") as stream:
        raw = stream.read(MAX_GEOJSON_BYTES + 1)
    if len(raw) > MAX_GEOJSON_BYTES:
        raise ValueError("Input exceeds the GeoJSON byte limit")
    return raw


def _bounded_json(path: Path, *, raw: bytes | None = None) -> dict:
    if raw is None:
        raw = _read_bounded_bytes(path)
    def unique_pairs(pairs):
        out = {}
        for k, value in pairs:
            if k in out:
                raise ValueError("Duplicate JSON key: " + k)
            out[k] = value
        return out
    obj = json.loads(raw, object_pairs_hook=unique_pairs,
                     parse_constant=lambda v: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
    if not isinstance(obj, dict):
        raise ValueError("JSON root must be an object")
    return obj


def _height_status(props: dict) -> tuple[str, float | None]:
    """Height is only an imported estimate, never independently measured."""
    raw = props.get("height_m")
    if raw is None:
        return "HEIGHT_NOT_EVIDENCED", None
    if isinstance(raw, bool) or not isinstance(raw, (float, int)) or not math.isfinite(raw) or raw <= 0:
        return "HEIGHT_INVALID", None
    return "HEIGHT_ESTIMATE_UNVERIFIED", float(raw)


def inspect(published: Path, pin: Path, *, include_geojson: bool = False) -> tuple[dict, dict | None]:
    reference = _bounded_json(pin)
    if reference.get("schemaVersion") != "tsm.posey.archived-igio-building-id-delta.v1":
        raise ValueError("Unexpected archived source identity pin format")
    expected = reference.get("sourceFeatureCount")
    if type(expected) is not int or expected <= 0 or expected > 1000000:
        raise ValueError("Invalid source feature count")
    if not isinstance(reference.get("missingArchivedSourceObjectIds"), list):
        raise ValueError("Missing pinned IDs list")
    missing = reference["missingArchivedSourceObjectIds"]
    if any(type(v) is not int or v < 0 for v in missing) or len(set(missing)) != len(missing):
        raise ValueError("Invalid or duplicate pinned missing IDs")
    published_raw = _read_bounded_bytes(published)
    data = _bounded_json(published, raw=published_raw)
    inventory = _inventory(published, file_bytes=published_raw)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError("Published GeoJSON must be a FeatureCollection")
    published_pin_matches = (inventory["sha256"] == reference.get("publishedAssetSha256")
                             and inventory["count"] == reference.get("publishedFeatureCount"))
    present_ids = inventory["ids"]
    if published_pin_matches and any(i in present_ids for i in missing):
        raise ValueError("Pinned missing ID is now present despite unchanged published hash")
    records = []
    overlay = []
    states = Counter()
    for row in data["features"]:
        if not isinstance(row, dict) or not isinstance(row.get("properties"), dict):
            states["INVALID_FEATURE"] += 1
            continue
        props = row["properties"]
        try:
            identifier = _identifier(props)
        except ValueError:
            states["CONFLICTING_SOURCE_IDS"] += 1
            continue
        if identifier is None:
            states["SOURCE_ID_UNAVAILABLE"] += 1
            continue
        height_state, value = _height_status(props)
        states[height_state] += 1
        if height_state != "HEIGHT_ESTIMATE_UNVERIFIED":
            records.append({"sourceObjectId": identifier, "issue": height_state,
                            "height_m": None, "verticalDatumVerified": False})
        if include_geojson:
            # Geometry is copied, not generated or modified. No owner attributes.
            overlay.append({"type": "Feature", "geometry": row.get("geometry"),
                            "properties": {"sourceObjectId": identifier,
                                           "qaStatus": height_state,
                                           "heightEstimateM": value,
                                           "verticalDatumVerified": False,
                                           "sourceLineageIndependentlyVerified": False}})
    # A count alone cannot reconstruct the real missing OBJECTID set.
    known_missing = missing if published_pin_matches else None
    report = {
        "schema": SCHEMA,
        "classification": "INFORMATIONAL_ONLY",
        "sourceReference": "ARCHIVED_PROJECT_SNAPSHOT_NOT_OFFICIAL_VINTAGE_CERTIFICATION",
        "sourceReferenceSha256": reference.get("sourceAssetSha256"),
        "publishedSha256": inventory["sha256"],
        "publishedPinMatchesActualBytes": published_pin_matches,
        "expectedArchivedSourceFeatureCount": expected,
        "publishedFeatureCount": inventory["count"],
        "publishedIdentifiedCount": inventory["identified_count"],
        "publishedDuplicateSourceObjectIds": inventory["duplicate_ids"],
        "publishedInvalidFeatureCount": inventory["invalid_features"],
        "expectedMinusPublishedCount": expected - inventory["count"],
        "archivedMissingObjectIdsIfPinnedBytesMatch": known_missing,
        "identityCoverageStatus": "PINNED_ARCHIVED_DELTA" if published_pin_matches else "SOURCE_ID_SET_UNVERIFIED",
        "heightEvidenceCounts": dict(sorted(states.items())),
        "missingOrInvalidHeightEstimates": sorted(records, key=lambda r: r["sourceObjectId"]),
        "sourceHeightAccuracyVerified": False,
        "sourceLineageIndependentlyVerified": False,
        "verticalDatumVerified": False,
        "meshGlbValidated": False,
        "tilesetPlacementValidated": False,
        "regulatoryDetermination": False,
        "engineeringUse": False,
        "fullEngineeringAcceptance": False,
        "notice": "Imported height estimates and archived counts are not surveyed elevations, NAVD88 transformations or actual 3D Tiles render validation.",
    }
    geojson = {"type": "FeatureCollection", "name": "TSM GeoTruth informational QA",
               "features": overlay} if include_geojson else None
    return report, geojson


def _write_new(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as stream:
        stream.write(content)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--published", type=Path, required=True)
    p.add_argument("--pinned-delta", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--qa-geojson", type=Path)
    args = p.parse_args(argv)
    inputs = {args.published.resolve(), args.pinned_delta.resolve()}
    outputs = [args.output] + ([args.qa_geojson] if args.qa_geojson else [])
    if any(path.resolve() in inputs for path in outputs) or len({p.resolve() for p in outputs}) != len(outputs):
        p.error("Output paths must be unique and must not overwrite inputs")
    if any(path.exists() for path in outputs):
        p.error("Output already exists; archived evidence cannot be overwritten")
    try:
        report, layer = inspect(args.published, args.pinned_delta, include_geojson=bool(args.qa_geojson))
        # Perform all serialization before writing any output.
        report_str = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
        layer_str = json.dumps(layer, separators=(",", ":"), allow_nan=False) if layer else None
        _write_new(args.output, report_str)
        if args.qa_geojson and layer_str is not None:
            _write_new(args.qa_geojson, layer_str)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        print("GeoTruth input/output error: " + str(exc), file=sys.stderr)
        return 2
    print("GeoTruth: " + str(report["publishedFeatureCount"]) +
          " published, pinned match=" + str(report["publishedPinMatchesActualBytes"]) +
          "; regulatory and surveyed elevation claims NOT VERIFIED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
