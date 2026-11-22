"""All-or-nothing verification of a saved USGS OGC continuous capture.

Only local bytes are read. A valid hash is a provenance receipt, not an
independent USGS signature or a vertical-datum transformation.
"""
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


def utc(value):
    if not isinstance(value, str):
        raise ValueError("Offset-aware USGS timestamp required")
    try:
        time = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Invalid USGS timestamp") from error
    if time.utcoffset() is None:
        raise ValueError("Offset-aware USGS timestamp required")
    return time.astimezone(timezone.utc)


def verify_capture(snapshot: Path, manifest: dict, stations: tuple, read_bounded):
    if snapshot.is_symlink() or not snapshot.is_dir():
        raise ValueError("Capture must be a regular directory")
    if not isinstance(manifest, dict) or manifest.get("schema") != "tsm.river-twin.observations.v1":
        raise ValueError("Unsupported USGS capture manifest")
    window = manifest.get("window")
    if not isinstance(window, list) or len(window) != 2:
        raise ValueError("USGS capture must declare a bounded window")
    start, end = map(utc, window)
    if start >= end or end > utc(manifest.get("finishedAt")):
        raise ValueError("USGS capture window exceeds retrieval timestamp")
    records = manifest.get("stations")
    if not isinstance(records, dict) or not set(records) <= set(stations):
        raise ValueError("Unknown USGS capture station")
    captured = {}
    for station, entry in records.items():
        if not isinstance(entry, dict) or entry.get("status") not in (
                "CAPTURED", "SOURCE_UNAVAILABLE", "NO_OBSERVATIONS"):
            raise ValueError("Unknown USGS capture status")
        if entry["status"] != "CAPTURED":
            continue
        url = urlsplit(entry.get("sourceUrl", ""))
        query = parse_qs(url.query, strict_parsing=True, keep_blank_values=True)
        if (url.scheme != "https" or url.netloc != "api.waterdata.usgs.gov" or
                url.path != "/ogcapi/v1/collections/continuous/items" or url.fragment):
            raise ValueError("Untrusted USGS source URL")
        if (set(query) != {"f", "monitoring_location_id", "parameter_code", "time", "limit"} or
                query.get("f") != ["json"] or
                query.get("monitoring_location_id") != [f"USGS-{station}"] or
                query.get("parameter_code") != ["00065"] or query.get("limit") != ["1000"]):
            raise ValueError("USGS source query does not match verified capture")
        period = query["time"][0].split("/")
        if len(period) != 2 or utc(period[0]) != start or utc(period[1]) != end:
            raise ValueError("USGS query time window does not match manifest")
        count = entry.get("featureCount")
        if type(count) is not int or not 1 <= count <= 1000:
            raise ValueError("Invalid USGS captured feature count")
        raw = read_bounded(snapshot / f"{station}.geojson")
        digest = hashlib.sha256(raw).hexdigest()
        if digest != entry.get("rawSha256"):
            raise ValueError(f"USGS snapshot SHA-256 mismatch: {station}")
        try:
            document = json.loads(raw, parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise ValueError("Invalid USGS source JSON") from error
        if (not isinstance(document, dict) or document.get("type") != "FeatureCollection" or
                not isinstance(document.get("features"), list) or len(document["features"]) != count):
            raise ValueError("USGS source observation inventory mismatch")
        links = document.get("links", [])
        if not isinstance(links, list) or any(
                not isinstance(link, dict) or link.get("rel") == "next" for link in links):
            raise ValueError("USGS source capture is paginated or incomplete")
        seen = set()
        for feature in document["features"]:
            if (not isinstance(feature, dict) or feature.get("type") != "Feature" or
                    not isinstance(feature.get("properties"), dict)):
                raise ValueError("Malformed captured USGS feature")
            p = feature["properties"]
            if (p.get("monitoring_location_id") != f"USGS-{station}" or
                    p.get("parameter_code") != "00065" or p.get("unit_of_measure") != "ft"):
                raise ValueError("Captured USGS feature mismatches station, parameter or unit")
            series = p.get("time_series_id")
            if not isinstance(series, str) or not 1 <= len(series) <= 128:
                raise ValueError("Invalid USGS time series identifier")
            timestamp = utc(p.get("time"))
            if not start <= timestamp <= end:
                raise ValueError("USGS observation timestamp outside capture window")
            identity = (series, timestamp)
            if identity in seen:
                raise ValueError("Duplicate captured USGS observation identity")
            seen.add(identity)
            raw_value = p.get("value")
            if raw_value is not None:
                if type(raw_value) not in (int, float, str) or (isinstance(raw_value, str) and not raw_value.strip()):
                    raise ValueError("Invalid USGS numeric value type")
                try:
                    number = float(raw_value)
                except (ValueError, OverflowError) as error:
                    raise ValueError("Non-numeric USGS reading") from error
                if not math.isfinite(number):
                    raise ValueError("Non-finite USGS reading")
            approval = p.get("approval_status")
            if approval is not None and (not isinstance(approval, str) or len(approval) > 256):
                raise ValueError("Invalid USGS approval status")
            geometry = feature.get("geometry")
            if geometry is not None:
                if not isinstance(geometry, dict) or geometry.get("type") != "Point":
                    raise ValueError("USGS geometry must be a WGS84 Point")
                coords = geometry.get("coordinates")
                if (not isinstance(coords, list) or len(coords) not in (2, 3) or
                        any(type(v) not in (int, float) or not math.isfinite(v) for v in coords) or
                        not -180 <= coords[0] <= 180 or not -90 <= coords[1] <= 90):
                    raise ValueError("Invalid USGS WGS84 station coordinates")
        captured[station] = {"document": document, "sha256": digest}
    return captured
