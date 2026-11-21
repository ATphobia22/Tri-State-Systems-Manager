"""Publish the river pilot's hash-bound USGS captures as observation events."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import NAMESPACE_URL, uuid5

from .contracts import canonical, stream_key, validate
from .kafka import Wire, producer, send
from .settings import INGRESS

MAX_SOURCE_BYTES = 4 * 1024 * 1024
STATIONS = ("03322000", "03378500")
NO_DATA = {-999, -9999, -8888}


def read_bounded(path):
    with path.open("rb") as handle:
        raw = handle.read(MAX_SOURCE_BYTES + 1)
    if len(raw) > MAX_SOURCE_BYTES:
        raise ValueError(f"Source artifact exceeds limit: {path.name}")
    return raw


def event_rows(snapshot: Path):
    manifest = json.loads(read_bounded(snapshot / "manifest.json"))
    if manifest["schema"] != "tsm.river-twin.observations.v1":
        raise ValueError("Unsupported USGS river pilot manifest")
    events = []
    for station in STATIONS:
        entry = manifest["stations"][station]
        if entry["status"] in ("SOURCE_UNAVAILABLE", "NO_OBSERVATIONS"):
            continue
        if entry["status"] != "CAPTURED":
            raise ValueError("Unknown USGS capture status")
        url = urlsplit(entry["sourceUrl"])
        filters = parse_qs(url.query)
        if (
            url.scheme != "https" or url.netloc != "api.waterdata.usgs.gov"
            or url.path != "/ogcapi/v1/collections/continuous/items"
            or filters.get("monitoring_location_id") != [f"USGS-{station}"]
            or filters.get("parameter_code") != ["00065"]
        ):
            raise ValueError("USGS source URI does not match the pilot station and parameter")
        raw = read_bounded(snapshot / f"{station}.geojson")
        digest = hashlib.sha256(raw).hexdigest()
        if digest != entry["rawSha256"]:
            raise ValueError(f"USGS snapshot SHA-256 mismatch: {station}")
        document = json.loads(raw)
        if document["type"] != "FeatureCollection" or len(document["features"]) != entry["featureCount"]:
            raise ValueError("Source observation inventory mismatch")
        for feature in document["features"]:
            props = feature["properties"]
            if (
                props.get("monitoring_location_id") != f"USGS-{station}"
                or props.get("parameter_code") != "00065" or props.get("unit_of_measure") != "ft"
                or not props.get("time_series_id")
            ):
                continue
            value = props.get("value")
            try:
                value = float(value) if type(value) in (int, float, str) else None
            except ValueError:
                value = None
            if value is not None and (not math.isfinite(value) or value in NO_DATA):
                value = None
            series = props["time_series_id"]
            entity = hashlib.sha256(f"{station}/{series}/{props['time']}".encode()).hexdigest()
            event = {
                "version": 1, "matrix": "O", "entity_id": f"usgs:{station}:{entity}",
                "timeline": "observed", "branch": "main", "valid_from": props["time"],
                "operation": "upsert", "geometry": feature.get("geometry"),
                "state": {
                    "sensor_id": f"USGS-{station}", "parameter": "00065",
                    "value": value, "unit": "ft", "quality": props.get("approval_status") or "UNKNOWN",
                    "vertical_reference": "STATION_GAGE_DATUM_UNRESOLVED",
                    "time_series_id": series, "source_feature_id": feature.get("id"),
                    "qualifier": props.get("qualifier"),
                },
                "source": {"authority": "USGS", "uri": entry["sourceUrl"],
                           "retrieved_at": manifest["finishedAt"], "sha256": digest},
                "asset": None, "evidence": [],
            }
            event["event_id"] = str(uuid5(NAMESPACE_URL, canonical(event)))
            validate(event)
            events.append(event)
    return events


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("snapshot", type=Path)
    directory = cli.parse_args().snapshot
    events = event_rows(directory)
    wire, client = Wire(), producer()
    for row in events:
        send(client, INGRESS, stream_key(row), wire.pack(row, INGRESS))
    print(json.dumps({"observation_events_published": len(events)}))
