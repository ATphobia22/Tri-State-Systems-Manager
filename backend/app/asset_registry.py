"""Read-only, deterministic regional asset snapshot from staged official gauge locations.

This is an inventory of station POINTS, not measurements, sensor hardware,
live operational state, flood geometry, or certified survey control. It is an
explicit bridge from the repo's staged geospatial data to the ontology/twin
and API surfaces. No network, credentials, background poll or database needed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SCHEMA_VERSION = "1.0.0"
DATASET_ID = "tsm-river-gauge-locations-v1"
SOURCE_PATH = (
    Path(__file__).resolve().parents[2]
    / "tsm-console/public/data/tsm-river-gauge-locations.geojson"
)
SOURCE_RELATIVE_PATH = "tsm-console/public/data/tsm-river-gauge-locations.geojson"
MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_FEATURES = 1000
_STATION = re.compile(r"[0-9]{8}\Z")


class AssetRegistrySourceError(ValueError):
    """The local source is absent or fails bounded provenance checks."""


def _required_text(value: Any, field: str, maximum: int = 256) -> str:
    if not isinstance(value, str) or not (0 < len(value.strip()) <= maximum):
        raise AssetRegistrySourceError(f"INVALID_{field.upper()}")
    return value.strip()


def _source_uri(value: Any, station_id: str) -> str:
    uri = _required_text(value, "source_uri", 512)
    parsed = urlsplit(uri)
    if (
        parsed.scheme != "https"
        or parsed.hostname != "waterdata.usgs.gov"
        or parsed.port is not None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path != f"/monitoring-location/USGS-{station_id}/"
    ):
        raise AssetRegistrySourceError("UNTRUSTED_STATION_SOURCE_URI")
    return uri


def _coordinates(feature: dict[str, Any]) -> list[float]:
    geometry = feature.get("geometry")
    if not isinstance(geometry, dict) or geometry.get("type") != "Point":
        raise AssetRegistrySourceError("STATION_GEOMETRY_MUST_BE_POINT")
    coords = geometry.get("coordinates")
    if not isinstance(coords, list) or len(coords) != 2:
        raise AssetRegistrySourceError("INVALID_WGS84_COORDINATES")
    if any(type(item) not in (int, float) or not math.isfinite(item) for item in coords):
        raise AssetRegistrySourceError("NONFINITE_WGS84_COORDINATES")
    lon, lat = coords
    if not (-180 <= lon <= 180 and -90 <= lat <= 90):
        raise AssetRegistrySourceError("WGS84_COORDINATES_OUT_OF_RANGE")
    return [float(lon), float(lat)]


def build_registry_snapshot(source: Path | None = None) -> dict[str, Any]:
    """Validate full local inventory before returning any partial records.

    A file digest attests to exact bytes loaded, not third-party correctness.
    No timestamp is invented: lastReviewedAt is a *source-declared* date.
    """
    path = source if source is not None else SOURCE_PATH
    try:
        if path.stat().st_size > MAX_SOURCE_BYTES:
            raise AssetRegistrySourceError("SOURCE_TOO_LARGE")
        raw = path.read_bytes()
    except OSError as exc:
        raise AssetRegistrySourceError("SOURCE_UNAVAILABLE") from exc
    if len(raw) > MAX_SOURCE_BYTES:
        raise AssetRegistrySourceError("SOURCE_TOO_LARGE")
    digest = hashlib.sha256(raw).hexdigest()
    try:
        document = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as exc:
        raise AssetRegistrySourceError("SOURCE_INVALID_JSON") from exc
    if not isinstance(document, dict) or document.get("type") != "FeatureCollection":
        raise AssetRegistrySourceError("SOURCE_NOT_FEATURE_COLLECTION")
    if document.get("crs") != "EPSG:4326":
        raise AssetRegistrySourceError("SOURCE_CRS_NOT_EPSG_4326")
    features = document.get("features")
    if not isinstance(features, list) or len(features) > MAX_FEATURES:
        raise AssetRegistrySourceError("INVALID_FEATURE_COUNT")

    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    for feature in features:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise AssetRegistrySourceError("INVALID_FEATURE")
        props = feature.get("properties")
        if not isinstance(props, dict):
            raise AssetRegistrySourceError("INVALID_STATION_PROPERTIES")
        station_id = _required_text(props.get("stationId"), "station_id", 8)
        if not _STATION.fullmatch(station_id):
            raise AssetRegistrySourceError("INVALID_STATION_ID")
        if station_id in seen:
            raise AssetRegistrySourceError("DUPLICATE_STATION_ID")
        seen.add(station_id)
        if (
            props.get("coordinateReferenceSystem") != "EPSG:4326"
            or props.get("locationOnly") is not True
            or props.get("automaticPolling") is not False
        ):
            raise AssetRegistrySourceError("STATION_LOCATION_CONTRACT_MISMATCH")
        uri = _source_uri(props.get("sourceUri"), station_id)
        records.append({
            "assetId": f"USGS-{station_id}",
            "assetType": "river_gauge_station",
            "ontologyKind": "sensor",
            "name": _required_text(props.get("name"), "station_name"),
            "riverName": _required_text(props.get("river"), "river_name"),
            "geometry": {"type": "Point", "coordinates": _coordinates(feature)},
            "spatialReference": {"crs": "EPSG:4326", "verticalDatum": None},
            "sourceDatasetIds": [DATASET_ID],
            "sourceUri": uri,
            "sourceReportedStatus": props.get("status") if isinstance(props.get("status"), str) else None,
            "evidenceClass": "SOURCE_STAGED_LOCATION_ONLY",
            "currentObservation": None,
            "observationTimestamp": None,
            "instrumentHealth": None,
        })
    records.sort(key=lambda item: item["assetId"])
    return {
        "schemaVersion": SCHEMA_VERSION,
        "datasetId": DATASET_ID,
        "sourceFile": SOURCE_RELATIVE_PATH,
        "sourceSha256": digest,
        "sourceDeclaredLastReviewedAt": document.get("lastReviewedAt"),
        "sourceDeclaredAuthority": document.get("authority"),
        "authorityLimit": "Staged station coordinates only; no live measurement or certified elevation.",
        "count": len(records),
        "assets": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Export audited, offline, read-only station asset snapshot")
    parser.add_argument("--source", type=Path, default=SOURCE_PATH)
    parser.add_argument("--output", type=Path, help="Explicit output JSON path; default is stdout")
    args = parser.parse_args()
    try:
        snapshot = build_registry_snapshot(args.source)
    except AssetRegistrySourceError as exc:
        parser.error(str(exc))
    payload = json.dumps(snapshot, indent=2, sort_keys=True, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(payload, encoding="utf-8")
    else:
        print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
