"""Publish the river pilot's hash-bound USGS captures as observation events."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import NAMESPACE_URL, uuid5

from .contracts import canonical, stream_key, validate
from .usgs_preflight import verify_capture
from .kafka import Wire, producer, send
from .settings import INGRESS

MAX_SOURCE_BYTES = 4 * 1024 * 1024
STATIONS = ("03322000", "03378500", "03377500")
NO_DATA = {-999, -9999, -8888}


def read_bounded(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"USGS source must be a regular local file: {path.name}")
    with path.open("rb") as handle:
        raw = handle.read(MAX_SOURCE_BYTES + 1)
    if len(raw) > MAX_SOURCE_BYTES:
        raise ValueError(f"Source artifact exceeds limit: {path.name}")
    return raw


def event_rows(snapshot: Path):
    manifest = json.loads(read_bounded(snapshot / "manifest.json"))
    if manifest["schema"] != "tsm.river-twin.observations.v1":
        raise ValueError("Unsupported USGS river pilot manifest")
    # Validate every captured source and every record first; a bad station
    # cannot leave an unnoticed hole in an otherwise successful publish.
    preflight = verify_capture(snapshot, manifest, STATIONS, read_bounded)
    events = []
    for station in STATIONS:
        if station not in preflight:
            continue
        entry = manifest["stations"][station]
        digest = preflight[station]["sha256"]
        document = preflight[station]["document"]
        for feature in document["features"]:
            props = feature["properties"]
            # Preflight checked all feature identities; do not silently skip.
            if (
                props.get("monitoring_location_id") != f"USGS-{station}"
                or props.get("parameter_code") != "00065" or props.get("unit_of_measure") != "ft"
                or not props.get("time_series_id")
            ):
                raise ValueError("USGS record changed after capture preflight")
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
    return sorted(events, key=lambda row: (row["valid_from"], row["entity_id"]))


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("snapshot", type=Path)
    cli.add_argument("--preview", action="store_true", help="Local verification only; no Kafka")
    options = cli.parse_args()
    events = event_rows(options.snapshot)
    if options.preview:
        print(json.dumps({"preflight": "VALID", "event_count": len(events),
                          "event_ids": [row["event_id"] for row in events]}))
        raise SystemExit(0)
    wire, client = Wire(), producer()
    for row in events:
        send(client, INGRESS, stream_key(row), wire.pack(row, INGRESS))
    print(json.dumps({"observation_events_published": len(events)}))
