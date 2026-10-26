#!/usr/bin/env python3
"""Verify a PINNED offline IGIO Posey footprint snapshot before it is used.

The source file is read only. The verifier cannot establish survey accuracy,
current IGIO authority, NAVD88 measurements or LiDAR-derived roof heights.
Those require independent acquisition/engineering acceptance evidence.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
from typing import Any

MAX_BYTES = 512 * 1024 * 1024
SOURCE_DATASET = "Indiana Building Footprints 2016-2020"
SHA256_HEX = set("0123456789abcdef")


class CachedSourceError(ValueError):
    pass


def file_sha256(path: Path, limit: int = MAX_BYTES) -> tuple[str, int]:
    if not path.is_file() or path.is_symlink():
        raise CachedSourceError("Snapshot must be a regular, non-symlink file")
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(block)
            if size > limit:
                raise CachedSourceError("Snapshot exceeds bounded-size verification limit")
            digest.update(block)
    if not size:
        raise CachedSourceError("Snapshot is empty")
    return digest.hexdigest(), size


def _validate_polygon(geometry: Any) -> None:
    if not isinstance(geometry, dict) or geometry.get("type") not in ("Polygon", "MultiPolygon"):
        raise CachedSourceError("IGIO footprint must contain Polygon/MultiPolygon geometry")
    gtype = geometry["type"]
    parts = [geometry.get("coordinates")] if gtype == "Polygon" else geometry.get("coordinates")
    if not isinstance(parts, list) or not parts:
        raise CachedSourceError("IGIO footprint has no polygon parts")
    for rings in parts:
        if not isinstance(rings, list) or not rings:
            raise CachedSourceError("IGIO footprint has no rings")
        for ring in rings:
            if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
                raise CachedSourceError("IGIO polygon ring is not explicitly closed")
            signed_area = 0.0
            for left, right in zip(ring, ring[1:]):
                for pt in (left, right):
                    if (not isinstance(pt, list) or len(pt) < 2 or
                        any(not isinstance(v, (float, int)) or isinstance(v, bool)
                            or not math.isfinite(v) for v in pt[:2])):
                        raise CachedSourceError("IGIO polygon coordinate must be finite")
                    lon, lat = pt[:2]
                    # Broad Indiana-state coordinate sanity only; this is
                    # not a geodetically approved AOI or exact county boundary.
                    if not (-90 < lon < -84 and 36 < lat < 42):
                        raise CachedSourceError("IGIO polygon is outside Indiana coordinate sanity bounds")
                signed_area += left[0] * right[1] - right[0] * left[1]
            if abs(signed_area) <= 1e-14:
                raise CachedSourceError("IGIO footprint contains a collapsed polygon ring")


def verify_igio_snapshot(path: Path, *, expected_sha256: str, expected_count: int) -> dict:
    expected = expected_sha256.lower()
    if len(expected) != 64 or any(c not in SHA256_HEX for c in expected):
        raise CachedSourceError("A pinned SHA-256 digest is required")
    if not isinstance(expected_count, int) or isinstance(expected_count, bool) or expected_count <= 0:
        raise CachedSourceError("Expected footprint count must be positive")
    digest, bytes_count = file_sha256(path)
    # Authenticate pinned bytes *before* interpreting untrusted metadata.
    if digest != expected:
        raise CachedSourceError("Offline snapshot SHA-256 differs from pinned evidence")
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CachedSourceError("Pinned snapshot is not valid UTF-8 GeoJSON") from exc
    if not isinstance(doc, dict) or doc.get("type") != "FeatureCollection":
        raise CachedSourceError("Cached snapshot must be an IGIO GeoJSON FeatureCollection")
    for key, wanted in (
        ("sourceAuthority", "Indiana Geographic Information Office"),
        ("sourceDataset", SOURCE_DATASET),
        ("geometryCrs", "EPSG:4326"),
    ):
        if key in doc and doc[key] != wanted:
            raise CachedSourceError("Cached IGIO source metadata conflicts with its pinned contract")
    if "elevationVerticalDatum" in doc and doc["elevationVerticalDatum"] != "NAVD88":
        raise CachedSourceError("Cached elevation datum cannot be reinterpreted as NAVD88")
    if "elevationVerticalUnits" in doc and doc["elevationVerticalUnits"] not in ("feet", "ft"):
        raise CachedSourceError("Cached elevation units do not match the published feet contract")
    features = doc.get("features")
    if not isinstance(features, list) or len(features) != expected_count:
        raise CachedSourceError("Pinned IGIO source feature count does not match required inventory")
    ids = []
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise CachedSourceError("IGIO inventory contains an invalid Feature record")
        props = feature.get("properties")
        if not isinstance(props, dict):
            raise CachedSourceError("IGIO source footprint has no properties")
        sid = props.get("igioObjectId")
        if not isinstance(sid, int) or isinstance(sid, bool) or sid < 0:
            raise CachedSourceError("IGIO OBJECTID must be a nonnegative integer")
        if props.get("county") not in (None, "Posey"):
            raise CachedSourceError("Cached IGIO record has an unexpected county")
        if props.get("lidarHeightDatum") not in (None, "NAVD88"):
            raise CachedSourceError("LiDAR height datum is incompatible with NAVD88")
        _validate_polygon(feature.get("geometry"))
        ids.append(sid)
    counts = Counter(ids)
    if len(counts) != expected_count:
        raise CachedSourceError("Cached IGIO snapshot contains duplicate OBJECTIDs")
    return {
        "schemaVersion": "tsm.igio-posey-cache-verification.v1",
        "status": "PINNED_BYTES_AND_IDS_VERIFIED",
        "sourceDataset": SOURCE_DATASET,
        "sourceCounty": "Posey",
        "sourceSha256": digest,
        "bytes": bytes_count,
        "uniqueSourceObjectIds": len(counts),
        "featureCount": len(features),
        "surveyGradeVerified": False,
        "sourceVintageIndependentlyVerified": False,
        "navd88AccuracyVerified": False,
        "heightsVerified": False,
        "regulatoryUse": False,
        "engineeringUse": False,
        "classification": "INFORMATIONAL_ONLY",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, type=Path)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--expected-count", required=True, type=int)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        result = verify_igio_snapshot(
            args.snapshot, expected_sha256=args.sha256, expected_count=args.expected_count
        )
        rendered = json.dumps(result, sort_keys=True, indent=2) + "\n"
        if args.report:
            if args.report.resolve() == args.snapshot.resolve() or args.report.exists():
                raise CachedSourceError("Report must not overwrite existing evidence or source")
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(rendered, encoding="utf-8", errors="strict")
        print(rendered, end="")
        return 0
    except (OSError, ValueError) as exc:
        # Path, geometry or user metadata is never emitted in public CI diagnostics.
        print(f"IGIO cache verification FAILED: {type(exc).__name__}", flush=True)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
